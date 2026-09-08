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
import { resolveEffectiveVariant, applyStockDelta } from '../utils/variantResolution';

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
async function resolveCart(cartItems: Array<{ productId: string; quantity: number; variantId?: string }>) {
  // Consolidate duplicates. Keyed on productId + variantId together so two
  // different variants of the same product stay as separate lines instead of
  // being merged into one (a plain productId-only key would collapse them).
  const consolidated = new Map<string, { productId: string; variantId?: string; quantity: number }>();
  for (const item of cartItems) {
    if (!item.productId) continue;
    const variantId = typeof item.variantId === 'string' && item.variantId.trim() !== '' ? item.variantId : undefined;
    const key = `${item.productId}::${variantId ?? ''}`;
    const existing = consolidated.get(key);
    consolidated.set(key, {
      productId: item.productId,
      variantId,
      quantity: (existing?.quantity || 0) + (Number(item.quantity) || 0),
    });
  }

  const finalCart = Array.from(consolidated.values()).filter(i => i.quantity > 0);

  if (finalCart.length === 0) throw new Error('EMPTY_CART');

  // Fetch all product docs in parallel instead of one-at-a-time
  const productSnaps = await Promise.all(
    finalCart.map(item => db.collection('products').doc(String(item.productId)).get())
  );

  // Fetch vendor-status docs for the distinct non-admin vendors in parallel too
  const vendorIds = Array.from(new Set(
    productSnaps
      .filter(s => s.exists)
      .map(s => s.data()!.vendorId)
      .filter((vid: string | undefined) => vid && vid !== 'admin')
  )) as string[];
  const vendorSnaps = await Promise.all(
    vendorIds.map(vid => db.collection('vendors').doc(vid).get())
  );
  const rejectedVendorIds = new Set(
    vendorSnaps.filter(s => s.exists && s.data()?.status === 'rejected').map(s => s.id)
  );

  let totalAmount = 0;
  const resolvedItems: Array<{
    productId: string; title: string; price: number; qty: number;
    subtotal: number; image: string; vendorId: string; currentStock: number;
    weight?: number; length?: number; breadth?: number; height?: number;
    variantId?: string; variantLabel?: string; sellerIsAdmin: boolean;
  }> = [];

  for (let idx = 0; idx < finalCart.length; idx++) {
    const cartItem = finalCart[idx];
    const snap = productSnaps[idx];
    if (!snap.exists) throw new Error(`PRODUCT_NOT_FOUND|${cartItem.productId}`);
    const p = snap.data()!;

    if (p.vendorId && p.vendorId !== 'admin' && rejectedVendorIds.has(p.vendorId)) {
      throw new Error(`PRODUCT_UNAVAILABLE|${cartItem.productId}`);
    }

    // Resolve where this item's price/stock/image actually live -- the
    // matching variant, an inferred single variant, or the flat fields (see
    // variantResolution.ts for the exact rule).
    const target = resolveEffectiveVariant(p, cartItem.variantId);
    if (!target) throw new Error(`PRODUCT_NOT_FOUND|${cartItem.productId}`);

    const resolvedLabel = target.source === 'variant' ? p.variants?.[target.index!]?.label : undefined;
    if (target.stock < cartItem.quantity) {
      throw new Error(`INSUFFICIENT_STOCK|${resolvedLabel ? `${p.title} (${resolvedLabel})` : p.title}|${target.stock}`);
    }

    const subtotal = target.price * cartItem.quantity;
    totalAmount += subtotal;
    const variantId = target.source === 'variant' ? p.variants?.[target.index!]?.id : undefined;
    resolvedItems.push({
      productId: cartItem.productId,
      title: p.title,
      price: target.price,
      qty: cartItem.quantity,
      subtotal,
      image: target.images[0] || '',
      vendorId: p.vendorId || 'admin',
      currentStock: target.stock,
      weight: p.weight || 0.5,
      length: p.length || 10,
      breadth: p.breadth || 10,
      height: p.height || 10,
      // Omitted entirely (not set to `undefined`) for a flat-priced item --
      // Firestore rejects any document field explicitly valued `undefined`,
      // which was silently breaking checkout for exactly this case (a
      // product with no matching single variant).
      ...(variantId ? { variantId } : {}),
      ...(resolvedLabel ? { variantLabel: resolvedLabel } : {}),
      // The reliable admin/vendor distinction -- vendorId itself is always
      // a real Firebase uid on both sides, never a special sentinel.
      sellerIsAdmin: !p.is_sold_by_vendor,
    });
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
  paymentIntentId?: string,
): Promise<string[]> {
  const createdOrderIds: string[] = [];
  const timestamp = new Date().toISOString();
  const orderIdBase = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

  await db.runTransaction(async (transaction) => {
    type IntentItem = { productId: string; title: string; price: number; qty: number; subtotal: number; image: string; vendorId: string; currentStock: number; weight?: number; length?: number; breadth?: number; height?: number; variantId?: string; variantLabel?: string; sellerIsAdmin?: boolean; };

    const vendorGroups = new Map<string, IntentItem[]>();
    for (const item of intent.items as IntentItem[]) {
      const g = vendorGroups.get(item.vendorId) || [];
      g.push(item);
      vendorGroups.set(item.vendorId, g);
    }

    // All reads first
    let intentRef: admin.firestore.DocumentReference | undefined;
    if (paymentIntentId) {
      intentRef = db.collection('paymentIntents').doc(paymentIntentId);
      const intentSnap = await transaction.get(intentRef);
      if (intentSnap.exists && intentSnap.data()?.status === 'paid') {
        throw new Error('ALREADY_PROCESSED');
      }
    }

    // One read per distinct product.
    const productRefs = new Map<string, admin.firestore.DocumentReference>();
    const productData = new Map<string, FirebaseFirestore.DocumentData>();
    for (const item of intent.items as IntentItem[]) {
      if (!productRefs.has(item.productId)) {
        const ref = db.collection('products').doc(String(item.productId));
        productRefs.set(item.productId, ref);
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new Error(`PRODUCT_NOT_FOUND|${item.productId}`);
        productData.set(item.productId, snap.data()!);
      }
    }

    // Apply each item's deduction against the running, in-memory copy of its
    // product's data (re-resolved fresh here, not reusing resolveCart's
    // pre-transaction resolution) -- so two lines for the same product (e.g.
    // two different variants) both see each other's effect, and the flat
    // `stock` mirror stays correct after every step.
    for (const item of intent.items as IntentItem[]) {
      const data = productData.get(item.productId)!;
      const target = resolveEffectiveVariant(data, item.variantId);
      if (!target) throw new Error(`PRODUCT_NOT_FOUND|${item.productId}`);
      if (target.stock < item.qty) {
        throw new Error(`INSUFFICIENT_STOCK|${target.label ? `${data.title} (${target.label})` : data.title}|${target.stock}`);
      }
      const update = applyStockDelta(data, target, -Number(item.qty));
      productData.set(item.productId, { ...data, ...update });
    }

    const productUpdates = new Map<string, Record<string, any>>();
    for (const [productId, data] of productData) {
      const update: Record<string, any> = { stock: data.stock };
      if (Array.isArray(data.variants)) update.variants = data.variants;
      productUpdates.set(productId, update);
    }

    // All writes
    let idx = 0;
    for (const [vendorId, items] of vendorGroups) {
      const vendorTotal = items.reduce((s: number, i: IntentItem) => s + i.subtotal, 0);
      // variantId/variantLabel omitted entirely (not set to `undefined`) for
      // a flat-priced item -- see the matching comment in resolveCart above.
      const orderItems: OrderItem[] = items.map((i: IntentItem) => ({
        productId: i.productId,
        title: i.title,
        price: i.price,
        qty: i.qty,
        subtotal: i.subtotal,
        image: i.image,
        weight: i.weight,
        length: i.length,
        breadth: i.breadth,
        height: i.height,
        ...(i.variantId ? { variantId: i.variantId } : {}),
        ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
      }));
      const newOrderRef = db.collection('orders').doc();
      const orderData: Order = {
        id: newOrderRef.id,
        orderId: `${orderIdBase}-${idx + 1}`,
        vendorId,
        // Every item in a vendor group shares the same seller by construction.
        sellerIsAdmin: !!items[0]?.sellerIsAdmin,
        customerId: intent.customerId,
        customerEmail: intent.customerEmail,
        shippingDetails: intent.shippingDetails,
        items: orderItems,
        totalAmount: vendorTotal,
        status: 'Approved',
        paymentMethod,
        createdAt: timestamp,
        timeline: [{ status: 'Approved', timestamp }],
        ...paymentFields,
      } as any;
      transaction.set(newOrderRef, orderData);
      createdOrderIds.push(newOrderRef.id);
      idx++;
    }
    for (const [pId, updates] of productUpdates) {
      transaction.update(productRefs.get(pId)!, updates);
    }
    
    if (intentRef) {
      transaction.update(intentRef, {
        status: 'paid',
        cashfreePaymentId: paymentFields.cashfreePaymentId || '',
        orderIds: createdOrderIds,
        paidAt: timestamp,
      });
    }
  });

  return createdOrderIds;
}

// ── Shared: push newly-created orders to Shiprocket ───────────────────────────
// Called from both the webhook and the /verify fallback -- whichever of the
// two actually ends up creating the orders (only one ever does, guarded by
// the paymentIntent's 'paid' status) is responsible for also shipping them,
// since the other path short-circuits on ALREADY_PROCESSED and never reaches
// this step.
function pushOrdersToShiprocket(orderIds: string[]) {
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
        if (err.response) {
          console.error('[Shiprocket] Response Data:', JSON.stringify(err.response.data, null, 2));
        }
      }
    }
  });
}

// ── Shared: generate PDF invoices and upload to Storage ──────────────────────
async function generateInvoices(orderIds: string[]): Promise<string[]> {
  const results = await Promise.all(orderIds.map(async (orderId): Promise<string | null> => {
    try {
      const snap = await db.collection('orders').doc(orderId).get();
      if (!snap.exists) return null;
      const orderData = snap.data() as Order;
      const pdfBuffer = await generateInvoicePdf(orderData);
      const file = storage.bucket().file(`invoices/${orderData.id}.pdf`);
      await file.save(pdfBuffer, { contentType: 'application/pdf', metadata: { metadata: { orderId: orderData.orderId, customerId: orderData.customerId } } });
      const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      await db.collection('orders').doc(orderId).update({ invoiceUrl: url });
      return url;
    } catch (err) {
      console.error('[Payments] PDF generation failed for order:', orderId, err);
      return null;
    }
  }));
  return results.filter((url): url is string => url !== null);
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

  const pincodeDigits = shippingDetails?.pincode?.replace(/\s/g, '') || '';
  if (!/^\d{6}$/.test(pincodeDigits)) {
    res.status(400).json({ error: 'Please provide a valid 6-digit Pincode.' });
    return;
  }

  try {
    const { totalAmount, resolvedItems } = await resolveCart(cartItems);

    if (totalAmount < 1) {
      res.status(400).json({ error: 'Order amount must be at least ₹1 to process online payment.' });
      return;
    }

    const cfOrderId = `CF_${req.user!.uid}_${Date.now()}`;
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || "https://medoxatoz.com";
    const backendUrl = process.env.BACKEND_URL || "https://server-production-e4da.up.railway.app";
    // Same return_url page for everyone -- confirmed empirically that Cashfree's
    // own client-side redirect won't complete to a custom URI scheme (medox://...),
    // so the app can't rely on Cashfree handing control back that way. medox-app
    // instead detects the app returning to the foreground after checkout
    // (AppState) and drives the WebView to this same status page itself, using
    // the cashfree_order_id it already has from create-order's response -- no
    // dependence on this return_url ever actually being reached by the app.
    //
    // The `app=1` marker is just UI routing (shows a "Go Back to App" button on
    // /checkout/status instead of "Continue Shopping") -- it's a plain query
    // param on an ordinary https URL, so it survives Cashfree's redirect fine;
    // it's not the medox:// scheme, which is what Cashfree's own JS wouldn't
    // navigate to.
    const isApp = /MedoxApp\//.test(req.headers['user-agent'] as string || '');
    const returnUrl = `${frontendUrl}/checkout/status?cashfree_order_id=${cfOrderId}${isApp ? '&app=1' : ''}`;

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
        notify_url: `${backendUrl}/api/payments/cashfree/webhook`,
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

    res.json({
      payment_session_id: sessionId,
      cashfree_order_id: cfOrderId,
      environment: cfEnvironment === CFEnvironment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX',
    });
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

    let orderIds: string[] = [];
    try {
      orderIds = await createOrdersInFirestore(
        intent as any,
        'Cashfree',
        { cashfreeOrderId: cfOrderId, cashfreePaymentId: cfPaymentId },
        intent.customerId,
        intent.customerEmail,
        cfOrderId
      );
    } catch (err: any) {
      if (err.message === 'ALREADY_PROCESSED') {
        res.status(200).json({ received: true, message: 'Already processed by another instance' });
        return;
      }
      throw err;
    }

    // Generate invoices (non-blocking for webhook response)
    generateInvoices(orderIds).then(async (urls) => {
      if (urls.length > 0) {
        await db.collection('paymentIntents').doc(cfOrderId).update({ invoiceUrls: urls }).catch(() => {});
      }
    }).catch(() => {});

    // Auto-push to Shiprocket
    pushOrdersToShiprocket(orderIds);

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

      let orderIds: string[] = [];
      try {
        orderIds = await createOrdersInFirestore(
          intent as any,
          'Cashfree',
          { cashfreeOrderId: cashfree_order_id, cashfreePaymentId: cfPaymentId },
          intent.customerId,
          intent.customerEmail,
          cashfree_order_id
        );
      } catch (err: any) {
        if (err.message === 'ALREADY_PROCESSED') {
          const freshIntent = (await db.collection('paymentIntents').doc(cashfree_order_id).get()).data()!;
          return res.status(200).json({ success: true, orderIds: freshIntent.orderIds || [], invoiceUrls: freshIntent.invoiceUrls || [] }) as any;
        }
        throw err;
      }

      const invoiceUrls = await generateInvoices(orderIds);
      pushOrdersToShiprocket(orderIds);

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
