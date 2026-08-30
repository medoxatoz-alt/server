// src/routes/payments.ts — Cashfree Payment Gateway

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import { db, storage } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { Order, OrderItem } from '../types';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { createShiprocketShipment } from '../utils/shiprocket';

const router = Router();

// ── Cashfree SDK Config ───────────────────────────────────────────────────────
const cfEnvironment = process.env.CASHFREE_ENV === 'PRODUCTION'
  ? CFEnvironment.PRODUCTION
  : CFEnvironment.SANDBOX;

const cashfreeClient = new Cashfree(
  cfEnvironment,
  process.env.CASHFREE_APP_ID!,
  process.env.CASHFREE_SECRET_KEY!
);

const CF_API_VERSION = '2023-08-01';

// ── Shared: validate cart, calculate total, resolve items ────────────────────
async function resolveCart(cartItems: Array<{ productId: string; quantity: number }>) {
  // Consolidate duplicates
  const consolidated = new Map<string, number>();
  for (const item of cartItems) {
    if (!item.productId) continue;
    consolidated.set(item.productId, (consolidated.get(item.productId) || 0) + (Number(item.quantity) || 0));
  }

  const finalCart = Array.from(consolidated.entries())
    .map(([productId, quantity]) => ({ productId, quantity }))
    .filter(i => i.quantity > 0);

  if (finalCart.length === 0) throw new Error('EMPTY_CART');

  let totalAmount = 0;
  const resolvedItems: Array<{
    productId: string; title: string; price: number; qty: number;
    subtotal: number; image: string; vendorId: string; currentStock: number;
  }> = [];

  for (const cartItem of finalCart) {
    const snap = await db.collection('products').doc(String(cartItem.productId)).get();
    if (!snap.exists) throw new Error(`PRODUCT_NOT_FOUND|${cartItem.productId}`);
    const p = snap.data()!;

    if (p.vendorId && p.vendorId !== 'admin') {
      const vendorSnap = await db.collection('vendors').doc(p.vendorId).get();
      if (vendorSnap.exists && vendorSnap.data()?.status === 'rejected') {
        throw new Error(`PRODUCT_UNAVAILABLE|${cartItem.productId}`);
      }
    }

    const stock = Number(p.stock) || 0;
    if (stock < cartItem.quantity) throw new Error(`INSUFFICIENT_STOCK|${p.title}|${stock}`);

    const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price) || 0;
    const imageField = p.images || p.image;
    let thumbnail = '';
    if (Array.isArray(imageField)) thumbnail = imageField[0] || '';
    else if (typeof imageField === 'string') thumbnail = imageField;

    const subtotal = price * cartItem.quantity;
    totalAmount += subtotal;
    resolvedItems.push({ productId: cartItem.productId, title: p.title, price, qty: cartItem.quantity, subtotal, image: thumbnail, vendorId: p.vendorId || 'admin', currentStock: stock });
  }

  return { totalAmount, resolvedItems };
}

// ── Shared: run Firestore transaction to create orders & deduct stock ─────────
async function createOrdersInFirestore(
  intent: { customerId: string; customerEmail: string; shippingDetails: any; items: any[]; },
  paymentMethod: string,
  paymentFields: Record<string, any>,
  userUid: string,
  userEmail: string,
): Promise<string[]> {
  const createdOrderIds: string[] = [];
  const timestamp = new Date().toISOString();
  const orderIdBase = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

  await db.runTransaction(async (transaction) => {
    type IntentItem = { productId: string; title: string; price: number; qty: number; subtotal: number; image: string; vendorId: string; currentStock: number; };

    const vendorGroups = new Map<string, IntentItem[]>();
    for (const item of intent.items as IntentItem[]) {
      const g = vendorGroups.get(item.vendorId) || [];
      g.push(item);
      vendorGroups.set(item.vendorId, g);
    }

    // All reads first
    const productRefs = new Map<string, admin.firestore.DocumentReference>();
    const newStocks = new Map<string, number>();

    for (const item of intent.items as IntentItem[]) {
      const ref = db.collection('products').doc(String(item.productId));
      productRefs.set(item.productId, ref);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error(`PRODUCT_NOT_FOUND|${item.productId}`);
      const currentStock = Number(snap.data()!.stock) || 0;
      const totalQty = (intent.items as IntentItem[]).filter(i => i.productId === item.productId).reduce((s, i) => s + Number(i.qty), 0);
      if (currentStock < totalQty) throw new Error(`INSUFFICIENT_STOCK|${item.title}|${currentStock}`);
      newStocks.set(item.productId, currentStock - totalQty);
    }

    // All writes
    let idx = 0;
    for (const [vendorId, items] of vendorGroups) {
      const vendorTotal = items.reduce((s: number, i: IntentItem) => s + i.subtotal, 0);
      const orderItems: OrderItem[] = items.map((i: IntentItem) => ({ productId: i.productId, title: i.title, price: i.price, qty: i.qty, subtotal: i.subtotal, image: i.image }));
      const newOrderRef = db.collection('orders').doc();
      const orderData: Order = {
        id: newOrderRef.id,
        orderId: `${orderIdBase}-${idx + 1}`,
        vendorId,
        customerId: intent.customerId,
        customerEmail: intent.customerEmail,
        shippingDetails: intent.shippingDetails,
        items: orderItems,
        totalAmount: vendorTotal,
        status: 'Pending',
        paymentMethod,
        createdAt: timestamp,
        timeline: [{ status: 'Pending', timestamp }],
        ...paymentFields,
      } as any;
      transaction.set(newOrderRef, orderData);
      createdOrderIds.push(newOrderRef.id);
      idx++;
    }
    for (const [pId, stock] of newStocks) {
      transaction.update(productRefs.get(pId)!, { stock });
    }
  });

  return createdOrderIds;
}

// ── Shared: generate PDF invoices and upload to Storage ──────────────────────
async function generateInvoices(orderIds: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const orderId of orderIds) {
    try {
      const snap = await db.collection('orders').doc(orderId).get();
      if (!snap.exists) continue;
      const orderData = snap.data() as Order;
      const pdfBuffer = await generateInvoicePdf(orderData);
      const file = storage.bucket().file(`invoices/${orderData.id}.pdf`);
      await file.save(pdfBuffer, { contentType: 'application/pdf', metadata: { metadata: { orderId: orderData.orderId, customerId: orderData.customerId } } });
      const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      await db.collection('orders').doc(orderId).update({ invoiceUrl: url });
      urls.push(url);
    } catch (err) {
      console.error('[Payments] PDF generation failed for order:', orderId, err);
    }
  }
  return urls;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/cashfree/create-order
// Creates a Cashfree order and returns the payment_session_id to the frontend.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cashfree/create-order', verifyToken, async (req: Request, res: Response) => {
  const { cartItems, shippingDetails } = req.body;
  if (!cartItems || cartItems.length === 0) { res.status(400).json({ error: 'Cart is empty.' }); return; }
  
  const phoneDigits = shippingDetails?.phone?.replace(/\D/g, '') || '';
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    res.status(400).json({ error: 'Please provide a valid 10-digit phone number.' });
    return;
  }

  try {
    const { totalAmount, resolvedItems } = await resolveCart(cartItems);

    // Create Cashfree order
    const cfOrderId = `CF_${req.user!.uid}_${Date.now()}`;
    const clientOrigin = req.headers.origin ||  "https://medoxatoz.com";
    const returnUrl = `${clientOrigin}/checkout/status?cashfree_order_id=${cfOrderId}`;

    const cfRequest = {
      order_id: cfOrderId,
      order_amount: parseFloat(totalAmount.toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: req.user!.uid,
        customer_email: req.user!.email || shippingDetails?.email || '',
        customer_phone: shippingDetails?.phone || '9999999999',
        customer_name: shippingDetails?.fullName || '',
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${process.env.ALLOWED_ORIGIN?.split(',')[0].replace('localhost:3004', 'localhost:5000').replace('localhost:3000', 'localhost:5000')}/api/payments/cashfree/webhook`,
      },
    };

    const cfResponse = await cashfreeClient.PGCreateOrder(cfRequest as any);
    const sessionId = cfResponse.data?.payment_session_id;

    if (!sessionId) {
      res.status(500).json({ error: 'Failed to create Cashfree payment session.' });
      return;
    }

    // Store payment intent in Firestore
    await db.collection('paymentIntents').doc(cfOrderId).set({
      provider: 'Cashfree',
      cashfreeOrderId: cfOrderId,
      customerId: req.user!.uid,
      customerEmail: req.user!.email,
      totalAmount,
      shippingDetails,
      items: resolvedItems,
      status: 'created',
      createdAt: new Date().toISOString(),
    });

    res.json({ payment_session_id: sessionId, cashfree_order_id: cfOrderId });
  } catch (err: any) {
    console.error('[Cashfree] create-order error:', err?.response?.data || err.message);
    if (err.message === 'EMPTY_CART') { res.status(400).json({ error: 'Cart is empty.' }); return; }
    if (err.message?.startsWith('PRODUCT_NOT_FOUND')) { res.status(404).json({ error: 'A product was not found.' }); return; }
    if (err.message?.startsWith('PRODUCT_UNAVAILABLE')) { res.status(400).json({ error: 'A product in your cart is no longer available.' }); return; }
    if (err.message?.startsWith('INSUFFICIENT_STOCK')) {
      const [, title, stock] = err.message.split('|');
      res.status(400).json({ error: `Insufficient stock for "${title}". Available: ${stock}` }); return;
    }
    res.status(500).json({ error: err?.response?.data?.message || 'Failed to initiate payment.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/cashfree/webhook
// Cashfree calls this after payment. HMAC-SHA256 verified. Creates orders.
// Requires raw body — express.json must stash req.rawBody.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cashfree/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const rawBody: string = (req as any).rawBody || '';

  if (!signature || !timestamp) {
    console.warn('[Cashfree Webhook] Missing signature headers');
    res.status(400).json({ error: 'Missing webhook headers' });
    return;
  }

  // Verify HMAC-SHA256 signature
  const signatureData = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.CASHFREE_SECRET_KEY!)
    .update(signatureData)
    .digest('base64');

  if (expectedSignature !== signature) {
    console.warn('[Cashfree Webhook] Signature mismatch');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = req.body;
  const eventType: string = event?.type || '';
  const paymentData = event?.data?.payment || event?.data || {};
  const cfOrderId: string = paymentData?.order?.order_id || event?.data?.order?.order_id || '';
  const cfPaymentId: string = paymentData?.cf_payment_id || paymentData?.payment_id || '';

  console.log(`[Cashfree Webhook] Event: ${eventType}, Order: ${cfOrderId}`);

  // Only process successful payments
  if (eventType !== 'PAYMENT_SUCCESS_WEBHOOK' && paymentData?.payment_status !== 'SUCCESS') {
    // Mark failed in Firestore if we have an order ID
    if (cfOrderId) {
      await db.collection('paymentIntents').doc(cfOrderId).update({ status: 'failed', failedAt: new Date().toISOString() }).catch(() => {});
    }
    res.status(200).json({ received: true });
    return;
  }

  try {
    const intentSnap = await db.collection('paymentIntents').doc(cfOrderId).get();
    if (!intentSnap.exists) {
      console.warn('[Cashfree Webhook] paymentIntent not found:', cfOrderId);
      res.status(200).json({ received: true });
      return;
    }

    const intent = intentSnap.data()!;

    // Guard: already processed
    if (intent.status === 'paid') {
      res.status(200).json({ received: true, message: 'Already processed' });
      return;
    }

    const orderIds = await createOrdersInFirestore(
      intent as any,
      'Cashfree',
      { cashfreeOrderId: cfOrderId, cashfreePaymentId: cfPaymentId },
      intent.customerId,
      intent.customerEmail,
    );

    // Mark intent as paid
    await db.collection('paymentIntents').doc(cfOrderId).update({
      status: 'paid',
      cashfreePaymentId: cfPaymentId,
      orderIds,
      paidAt: new Date().toISOString(),
    });

    // Generate invoices (non-blocking for webhook response)
    generateInvoices(orderIds).then(async (urls) => {
      if (urls.length > 0) {
        await db.collection('paymentIntents').doc(cfOrderId).update({ invoiceUrls: urls }).catch(() => {});
      }
    }).catch(() => {});

    // Auto-push to Shiprocket
    setImmediate(async () => {
      for (const id of orderIds) {
        try {
          const snap = await db.collection('orders').doc(id).get();
          if (!snap.exists) continue;
          const fullOrder = snap.data() as Order;
          const sr = await createShiprocketShipment(fullOrder);
          await db.collection('orders').doc(id).update({
            shiprocketOrderId: sr.shiprocketOrderId,
            shiprocketShipmentId: sr.shiprocketShipmentId,
            awbCode: sr.awbCode,
            courierName: sr.courierName,
            trackingId: sr.awbCode,
            trackingLink: sr.trackingLink,
          });
          console.log(`[Shiprocket] Shipment created for Cashfree order ${fullOrder.orderId}: AWB=${sr.awbCode}`);
        } catch (err: any) {
          console.error('[Shiprocket] Failed to create shipment for order', id, ':', err.message);
        }
      }
    });

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Cashfree Webhook] Error processing payment:', err.message);
    await db.collection('paymentIntents').doc(cfOrderId).update({ status: 'error', error: err.message }).catch(() => {});
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/cashfree/verify
// Called by frontend after returning from Cashfree. Checks if orders were created.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cashfree/verify', verifyToken, async (req: Request, res: Response) => {
  const { cashfree_order_id } = req.body as { cashfree_order_id: string };
  if (!cashfree_order_id) { res.status(400).json({ error: 'Missing cashfree_order_id' }); return; }

  try {
    // Check if webhook already created the orders
    const intentSnap = await db.collection('paymentIntents').doc(cashfree_order_id).get();
    if (!intentSnap.exists) { res.status(404).json({ error: 'Payment intent not found.' }); return; }

    const intent = intentSnap.data()!;
    if (intent.customerId !== req.user!.uid) { res.status(403).json({ error: 'Unauthorized.' }); return; }

    if (intent.status === 'paid') {
      return res.status(200).json({ success: true, orderIds: intent.orderIds || [], invoiceUrls: intent.invoiceUrls || [] }) as any;
    }

    // Webhook may not have fired yet — poll Cashfree for payment status
    const cfResponse = await cashfreeClient.PGFetchOrder(cashfree_order_id);
    const orderStatus = cfResponse.data?.order_status;

    if (orderStatus === 'PAID') {
      // Create orders now (webhook was late or missed)
      const cfPaymentId = cfResponse.data?.cf_order_id?.toString() || cashfree_order_id;

      const orderIds = await createOrdersInFirestore(
        intent as any,
        'Cashfree',
        { cashfreeOrderId: cashfree_order_id, cashfreePaymentId: cfPaymentId },
        intent.customerId,
        intent.customerEmail,
      );

      await db.collection('paymentIntents').doc(cashfree_order_id).update({
        status: 'paid',
        cashfreePaymentId: cfPaymentId,
        orderIds,
        paidAt: new Date().toISOString(),
      });

      const invoiceUrls = await generateInvoices(orderIds);

      return res.status(201).json({ success: true, orderIds, invoiceUrls }) as any;
    }

    if (orderStatus === 'ACTIVE') {
      res.status(202).json({ success: false, status: 'PENDING', message: 'Payment not completed yet.' });
      return;
    }

    // Payment failed
    await db.collection('paymentIntents').doc(cashfree_order_id).update({ status: 'failed', failedAt: new Date().toISOString() });
    res.status(400).json({ success: false, status: 'FAILED', message: 'Payment was not successful.' });
  } catch (err: any) {
    console.error('[Cashfree] verify error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
router.post('/place-order', verifyToken, async (req: Request, res: Response) => {
  const { cartItems, shippingDetails } = req.body;
  if (!cartItems || cartItems.length === 0) { res.status(400).json({ error: 'Cart is empty.' }); return; }

  const phoneDigits = shippingDetails?.phone?.replace(/\D/g, '') || '';
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    res.status(400).json({ error: 'Please provide a valid 10-digit phone number.' });
    return;
  }

  try {
    const { resolvedItems, totalAmount } = await resolveCart(cartItems);

    const intent = {
      customerId: req.user!.uid,
      customerEmail: req.user!.email,
      shippingDetails,
      items: resolvedItems,
    };

    const orderIds = await createOrdersInFirestore(intent, 'COD', {}, req.user!.uid, req.user!.email);
    const invoiceUrls = await generateInvoices(orderIds);

    res.status(201).json({ success: true, orderIds, invoiceUrls });
  } catch (err: any) {
    console.error('[Payments COD] place-order error:', err.message);
    if (err.message === 'EMPTY_CART') { res.status(400).json({ error: 'Cart is empty.' }); return; }
    if (err.message?.startsWith('PRODUCT_NOT_FOUND')) { res.status(404).json({ error: 'A product was not found.' }); return; }
    if (err.message?.startsWith('PRODUCT_UNAVAILABLE')) { res.status(400).json({ error: 'A product in your cart is no longer available.' }); return; }
    if (err.message?.startsWith('INSUFFICIENT_STOCK')) {
      const [, title, stock] = err.message.split('|');
      res.status(400).json({ error: `Insufficient stock for "${title}". Available: ${stock}` }); return;
    }
    res.status(500).json({ error: 'Failed to place order.' });
  }
});

export default router;
