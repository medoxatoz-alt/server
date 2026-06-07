// src/routes/orders.ts

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { Order, OrderItem } from '../types';

const router = Router();

// ─────────────────────────────────────────────────────────
// STATUS TRANSITION VALIDATOR
// ─────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  Pending: ['Approved', 'Rejected'],
  Approved: ['Delivered'],
  Rejected: [],     // Terminal state
  Delivered: [],    // Terminal state
};

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// ─────────────────────────────────────────────────────────
// GET /api/orders/my  —  Buyer's own orders
// ─────────────────────────────────────────────────────────
router.get('/my', verifyToken, async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('orders').where('customerId', '==', req.user!.uid).get();
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/vendor  —  Vendor's own orders
// ─────────────────────────────────────────────────────────
router.get('/vendor', verifyToken, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const vendorIds = isAdmin ? [req.user!.uid, 'admin'] : [req.user!.uid];

    const snap = await db.collection('orders').where('vendorId', 'in', vendorIds).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendor orders.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/orders  —  Admin: all orders
// ─────────────────────────────────────────────────────────
router.get('/', verifyToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('orders').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/orders  —  Place order (1 order per product)
// ─────────────────────────────────────────────────────────
router.post('/', verifyToken, async (req: Request, res: Response) => {
  const { cartItems, shippingDetails, paymentMethod } = req.body as {
    cartItems: Array<{ productId: string; quantity: number }>;
    shippingDetails: Order['shippingDetails'];
    paymentMethod: string;
  };

  try {
    const createdOrderIds = await db.runTransaction(async (transaction) => {
      // 1. Read all product docs in the transaction
      const productRefs = cartItems.map(item => db.collection('products').doc(String(item.productId)));
      const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

      // 2. Validate stock levels
      const productsData: Array<{ id: string; ref: admin.firestore.DocumentReference; data: any; qty: number }> = [];
      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        if (!snap.exists) {
          throw new Error('PRODUCT_NOT_FOUND');
        }
        const p = snap.data()!;
        const qty = cartItems[i].quantity;
        const stock = Number(p.stock) || 0;
        if (stock < qty) {
          throw new Error(`INSUFFICIENT_STOCK|${p.title}|${stock}`);
        }
        productsData.push({ id: snap.id, ref: snap.ref, data: p, qty });
      }

      // 3. Deduct stock and write orders
      const timestamp = new Date().toISOString();
      const orderIdBase = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      const orderIds: string[] = [];

      for (let i = 0; i < productsData.length; i++) {
        const { id, ref, data: p, qty } = productsData[i];
        const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price) || 0;
        const vendorId = p.vendorId || 'admin';

        // Deduct stock in transaction
        const newStock = (Number(p.stock) || 0) - qty;
        transaction.update(ref, { stock: newStock });

        // Resolve thumbnail
        const imageField = p.images || p.image;
        let thumbnail = '';
        if (Array.isArray(imageField)) thumbnail = imageField[0] || '';
        else if (typeof imageField === 'string') thumbnail = imageField;

        const item: OrderItem = {
          productId: id,
          title: p.title,
          price,
          qty,
          subtotal: price * qty,
          image: thumbnail,
        };

        const newOrderRef = db.collection('orders').doc(); // Create a new doc reference with auto ID
        const orderData: Order = {
          id: newOrderRef.id,
          orderId: `${orderIdBase}-${i + 1}`,
          vendorId,
          customerId: req.user!.uid,
          customerEmail: req.user!.email,
          shippingDetails,
          items: [item],
          totalAmount: price * qty,
          status: 'Pending',
          paymentMethod: paymentMethod || 'Cash on Delivery (COD)',
          createdAt: timestamp,
          timeline: [{ status: 'Pending', timestamp }],
        };

        transaction.set(newOrderRef, orderData);
        orderIds.push(newOrderRef.id);
      }

      return orderIds;
    });

    res.status(201).json({ success: true, orderIds: createdOrderIds });
  } catch (error: any) {
    console.error('Error placing order:', error);
    if (error.message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ error: 'Product not found.' });
    } else if (error.message && error.message.startsWith('INSUFFICIENT_STOCK')) {
      const [, title, stock] = error.message.split('|');
      res.status(400).json({ error: `Insufficient stock for product "${title}". Available: ${stock}` });
    } else {
      res.status(500).json({ error: 'Failed to place order.' });
    }
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/orders/:id  —  Update order status
// Strict ownership + valid transition enforcement
// ─────────────────────────────────────────────────────────
router.patch('/:id', verifyToken, async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  try {
    const orderRef = db.collection('orders').doc(String(req.params.id));
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const orderData = orderSnap.data()!;
    const currentStatus: string = orderData.status;

    // ── Ownership check ──────────────────────────────────
    const isVendorMatch = orderData.vendorId === req.user!.uid;
    const isAdminMatch = orderData.vendorId === 'admin' && req.user!.role === 'admin';

    if (!isVendorMatch && !isAdminMatch) {
      res.status(403).json({
        error: 'Unauthorized. Only the vendor who owns this order can update it.',
      });
      return;
    }

    // ── Transition validation ────────────────────────────
    if (!isValidTransition(currentStatus, status)) {
      res.status(400).json({
        error: `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${(VALID_TRANSITIONS[currentStatus] || []).join(', ') || 'none (terminal state)'}`,
      });
      return;
    }

    // ── Apply update with timeline entry ─────────────────
    const timestamp = new Date().toISOString();
    const timelineEntry = { status, timestamp };

    await orderRef.update({
      status,
      [`${status.toLowerCase()}At`]: timestamp,
      timeline: admin.firestore.FieldValue.arrayUnion(timelineEntry),
    });

    if (status === 'Rejected') {
      try {
        for (const item of orderData.items) {
          const productRef = db.collection('products').doc(String(item.productId));
          const productSnap = await productRef.get();
          if (productSnap.exists) {
            const currentStock = Number(productSnap.data()!.stock) || 0;
            await productRef.update({ stock: currentStock + item.qty });
          }
        }
      } catch (err) {
        console.error("Failed to restore stock on rejection:", err);
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update order.' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/orders/:id  —  Admin delete
// ─────────────────────────────────────────────────────────
router.delete('/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderRef = db.collection('orders').doc(String(req.params.id));
    const orderSnap = await orderRef.get();
    if (orderSnap.exists) {
      const orderData = orderSnap.data()!;
      if (orderData.status === 'Pending' || orderData.status === 'Approved') {
        try {
          for (const item of orderData.items) {
            const productRef = db.collection('products').doc(String(item.productId));
            const productSnap = await productRef.get();
            if (productSnap.exists) {
              const currentStock = Number(productSnap.data()!.stock) || 0;
              await productRef.update({ stock: currentStock + item.qty });
            }
          }
        } catch (err) {
          console.error("Failed to restore stock on order deletion:", err);
        }
      }
    }
    await orderRef.delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete order.' });
  }
});

export default router;
