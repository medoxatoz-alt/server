// src/routes/payments.ts — Razorpay Payment Integration
// SECURE: Keys are server-side only. Orders are created ONLY after payment verification.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { db, storage } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { Order, OrderItem } from '../types';
import { generateInvoicePdf } from '../utils/pdfGenerator';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

const router = Router();

// ─── Razorpay Instance (server-side only) ──────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order. Returns the Razorpay order_id + public key_id.
// No Firestore order is written here — only after payment verification.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', verifyToken, async (req: Request, res: Response) => {
  const { cartItems, shippingDetails } = req.body as {
    cartItems: Array<{ productId: string; quantity: number }>;
    shippingDetails: Order['shippingDetails'];
  };

  if (!cartItems || cartItems.length === 0) {
    res.status(400).json({ error: 'Cart is empty.' });
    return;
  }

  try {
    // 0. Consolidate duplicate cart items to prevent stock check bypass exploit
    const consolidatedCart = new Map<string, number>();
    for (const item of cartItems) {
      if (!item.productId) continue;
      const currentQty = consolidatedCart.get(item.productId) || 0;
      consolidatedCart.set(item.productId, currentQty + (Number(item.quantity) || 0));
    }
    
    const finalCartItems = Array.from(consolidatedCart.entries())
      .map(([productId, quantity]) => ({ productId, quantity }))
      .filter(item => item.quantity > 0);

    if (finalCartItems.length === 0) {
      res.status(400).json({ error: 'Cart is empty or invalid.' });
      return;
    }

    // 1. Validate products & calculate total
    let totalAmount = 0;
    const resolvedItems: Array<{
      productId: string;
      title: string;
      price: number;
      qty: number;
      subtotal: number;
      image: string;
      vendorId: string;
      currentStock: number;
    }> = [];

    for (const cartItem of finalCartItems) {
      const productSnap = await db.collection('products').doc(String(cartItem.productId)).get();
      if (!productSnap.exists) {
        res.status(404).json({ error: `Product not found: ${cartItem.productId}` });
        return;
      }
      const p = productSnap.data()!;
      const stock = Number(p.stock) || 0;
      if (stock < cartItem.quantity) {
        res.status(400).json({
          error: `Insufficient stock for "${p.title}". Available: ${stock}`,
        });
        return;
      }
      const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price) || 0;
      const imageField = p.images || p.image;
      let thumbnail = '';
      if (Array.isArray(imageField)) thumbnail = imageField[0] || '';
      else if (typeof imageField === 'string') thumbnail = imageField;

      const subtotal = price * cartItem.quantity;
      totalAmount += subtotal;
      resolvedItems.push({
        productId: cartItem.productId,
        title: p.title,
        price,
        qty: cartItem.quantity,
        subtotal,
        image: thumbnail,
        vendorId: p.vendorId || 'admin',
        currentStock: stock,
      });
    }

    // 2. Create Razorpay order (amount in paise = INR * 100)
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        customerId: req.user!.uid,
        customerEmail: req.user!.email,
      },
    });

    // 3. Store a pending payment intent in Firestore (not an order yet)
    // This lets us verify later that the payment was for the right amount
    await db.collection('paymentIntents').doc(razorpayOrder.id).set({
      razorpayOrderId: razorpayOrder.id,
      customerId: req.user!.uid,
      customerEmail: req.user!.email,
      totalAmount,
      shippingDetails,
      items: resolvedItems,
      status: 'created',
      createdAt: new Date().toISOString(),
    });

    // 4. Return order details + public key (key_id is safe to expose)
    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    // Log full Razorpay error detail for debugging
    console.error('[Payments] create-order error:', JSON.stringify(err?.error || err, null, 2));
    const razorpayMsg = err?.error?.description || err?.message || 'Unknown error';
    res.status(500).json({ error: `Failed to create payment order: ${razorpayMsg}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify
// Verifies Razorpay payment signature. Only creates Firestore orders on success.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', verifyToken, async (req: Request, res: Response) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing payment verification fields.' });
    return;
  }

  try {
    // 1. Verify HMAC-SHA256 signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Signature mismatch → payment tampered or invalid
      await db.collection('paymentIntents').doc(razorpay_order_id).update({
        status: 'signature_mismatch',
        razorpay_payment_id,
        failedAt: new Date().toISOString(),
      });
      res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
      return;
    }

    // 2. Load the stored payment intent
    const intentSnap = await db.collection('paymentIntents').doc(razorpay_order_id).get();
    if (!intentSnap.exists) {
      res.status(404).json({ error: 'Payment intent not found.' });
      return;
    }
    const intent = intentSnap.data()!;

    // 3. Guard: ensure this is the same user who initiated payment
    if (intent.customerId !== req.user!.uid) {
      res.status(403).json({ error: 'Unauthorized payment verification.' });
      return;
    }

    // 4. Guard: prevent double-processing
    if (intent.status === 'paid') {
      res.status(200).json({ success: true, message: 'Already processed.' });
      return;
    }

    // 5. Create Firestore orders in a transaction (one per product/vendor)
    const timestamp = new Date().toISOString();
    const orderIdBase = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const createdOrderIds: string[] = [];

    await db.runTransaction(async (transaction) => {
      // Group items by vendor
      type IntentItem = {
        productId: string; title: string; price: number; qty: number;
        subtotal: number; image: string; vendorId: string; currentStock: number;
      };
      const vendorGroups = new Map<string, IntentItem[]>();
      for (const item of (intent.items as IntentItem[])) {
        const group = vendorGroups.get(item.vendorId) || [];
        group.push(item);
        vendorGroups.set(item.vendorId, group);
      }

      // 1. ALL READS FIRST (Firestore Transaction Rule)
      const productRefs = new Map<string, admin.firestore.DocumentReference>();
      const currentStocks = new Map<string, number>();

      for (const item of (intent.items as IntentItem[])) {
        const productRef = db.collection('products').doc(String(item.productId));
        productRefs.set(item.productId, productRef);
        
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists) {
          throw new Error(`PRODUCT_NOT_FOUND|${item.productId}`);
        }
        
        const currentStock = Number(productSnap.data()!.stock) || 0;
        
        // Sum the quantity requested for this specific product across ALL cart items 
        // (incase duplicate items bypassed the create-order somehow)
        const totalRequestedQty = (intent.items as IntentItem[])
          .filter(i => i.productId === item.productId)
          .reduce((sum, i) => sum + Number(i.qty), 0);
        
        if (currentStock < totalRequestedQty) {
          throw new Error(`INSUFFICIENT_STOCK|${item.title}|${currentStock}`);
        }
        // Save the *new* stock after deduction so we can accurately update it later
        currentStocks.set(item.productId, currentStock - totalRequestedQty);
      }

      // 2. ALL WRITES AFTER READS
      let orderIndex = 0;
      for (const [vendorId, items] of vendorGroups) {
        const vendorTotal = items.reduce((sum: number, i: IntentItem) => sum + i.subtotal, 0);
        const orderItems: OrderItem[] = items.map((i: IntentItem) => ({
          productId: i.productId,
          title: i.title,
          price: i.price,
          qty: i.qty,
          subtotal: i.subtotal,
          image: i.image,
        }));

        const newOrderRef = db.collection('orders').doc();
        const orderData: Order = {
          id: newOrderRef.id,
          orderId: `${orderIdBase}-${orderIndex + 1}`,
          vendorId,
          customerId: req.user!.uid,
          customerEmail: req.user!.email,
          shippingDetails: intent.shippingDetails,
          items: orderItems,
          totalAmount: vendorTotal,
          status: 'Pending',
          paymentMethod: 'Razorpay',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          createdAt: timestamp,
          timeline: [{ status: 'Pending', timestamp }],
        } as any;

        transaction.set(newOrderRef, orderData);
        createdOrderIds.push(newOrderRef.id);
        orderIndex++;
      }

      // Update stock accurately using the consolidated deductions we calculated during reads
      for (const [pId, newStock] of currentStocks) {
        const pRef = productRefs.get(pId)!;
        transaction.update(pRef, { stock: newStock });
      }

      // Mark payment intent as paid
      transaction.update(db.collection('paymentIntents').doc(razorpay_order_id), {
        status: 'paid',
        razorpay_payment_id,
        razorpay_signature,
        orderIds: createdOrderIds,
        paidAt: timestamp,
      });
    });

    // --- Post-Transaction: Generate PDF Invoices ---
    const invoiceUrls: string[] = [];
    try {
      for (const orderId of createdOrderIds) {
        const orderSnap = await db.collection('orders').doc(orderId).get();
        if (orderSnap.exists) {
          const orderData = orderSnap.data() as Order;
          
          // Generate PDF Buffer
          const pdfBuffer = await generateInvoicePdf(orderData);
          
          // Upload to Firebase Storage
          const file = storage.bucket().file(`invoices/${orderData.id}.pdf`);
          await file.save(pdfBuffer, {
            contentType: 'application/pdf',
            metadata: {
              metadata: {
                orderId: orderData.orderId,
                customerId: orderData.customerId,
              }
            }
          });

          // Generate Signed URL valid for 30 days
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          // Save URL back to Firestore
          await db.collection('orders').doc(orderId).update({
            invoiceUrl: url
          });
          invoiceUrls.push(url);
        }
      }
    } catch (pdfErr) {
      console.error('[Payments] Failed to generate/upload invoice PDF:', pdfErr);
      // We don't fail the user request here because the order is successfully placed.
    }

    res.status(201).json({ success: true, orderIds: createdOrderIds, invoiceUrls });
  } catch (err: any) {
    console.error('[Payments] verify error:', err);

    // Record failure in paymentIntent for audit
    try {
      await db.collection('paymentIntents').doc(razorpay_order_id).update({
        status: 'error',
        error: err.message,
        failedAt: new Date().toISOString(),
      });
    } catch (_) {}

    if (err.message?.startsWith('PRODUCT_NOT_FOUND')) {
      res.status(404).json({ error: 'A product in your order was not found.' });
    } else if (err.message?.startsWith('INSUFFICIENT_STOCK')) {
      const [, title, stock] = err.message.split('|');
      res.status(400).json({ error: `Insufficient stock for "${title}". Available: ${stock}` });
    } else {
      res.status(500).json({ error: 'Payment verified but order creation failed. Contact support with your payment ID.' });
    }
  }
});

export default router;
