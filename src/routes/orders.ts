// src/routes/orders.ts

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { Order, OrderItem } from '../types';
import { createShiprocketShipment, cancelShiprocketOrder } from '../utils/shiprocket';



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

  try {
    const createdOrderIds = await db.runTransaction(async (transaction) => {
      // 1. Read all product docs in the transaction
      const productDocs = new Map<string, admin.firestore.DocumentSnapshot>();
      
      for (const item of finalCartItems) {
        const ref = db.collection('products').doc(String(item.productId));
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new Error('PRODUCT_NOT_FOUND');
        }
        
        const p = snap.data()!;
        const stock = Number(p.stock) || 0;
        if (stock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK|${p.title}|${stock}`);
        }
        productDocs.set(item.productId, snap);
      }

      // 3. Deduct stock and write orders
      const timestamp = new Date().toISOString();
      const orderIdBase = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      const innerCreatedOrderIds: string[] = [];

      let i = 0;
      for (const cartItem of finalCartItems) {
        const id = cartItem.productId;
        const qty = cartItem.quantity;
        const snap = productDocs.get(id)!;
        const p = snap.data()!;
        const ref = snap.ref;
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
        innerCreatedOrderIds.push(newOrderRef.id);
        i++;
      }

      return innerCreatedOrderIds;
    });

    res.status(201).json({ success: true, orderIds: createdOrderIds });

    // ── Auto-push to Shiprocket for COD ───────────────────────────────────────
    if (paymentMethod === 'Cash on Delivery (COD)' || paymentMethod === 'COD') {
      setImmediate(async () => {
        for (const id of createdOrderIds) {
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
            console.log(`[Shiprocket] Shipment created for COD order ${fullOrder.orderId}: AWB=${sr.awbCode}`);
          } catch (err: any) {
            console.error('[Shiprocket] Failed to create shipment for order', id, ':', err.message);
          }
        }
      });
    }

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
  const { status, trackingId, trackingLink } = req.body as {
    status: string;
    trackingId?: string;  // optional — Shiprocket auto-fills this
    trackingLink?: string; // optional — Shiprocket auto-fills this
  };
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
        error: 'Unauthorized. Only the creator who owns this order can update it.',
      });
      return;
    }
    
    if (req.user!.role === 'admin' && orderData.vendorId !== 'admin') {
      res.status(403).json({
        error: 'Administrators cannot modify orders belonging to specific vendors.',
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

    // trackingId/trackingLink are now optional — Shiprocket fills them automatically on approval

    // ── Apply update with timeline entry ─────────────────
    const timestamp = new Date().toISOString();
    const timelineEntry = { status, timestamp };

    const updateFields: any = {
      status,
      [`${status.toLowerCase()}At`]: timestamp,
      timeline: admin.firestore.FieldValue.arrayUnion(timelineEntry),
    };

    // Preserve any manually supplied tracking fields (fallback)
    if (status === 'Approved' && trackingId?.trim()) updateFields.trackingId = trackingId.trim();
    if (status === 'Approved' && trackingLink?.trim()) updateFields.trackingLink = trackingLink.trim();

    await orderRef.update(updateFields);

    // ── Post-update side-effects ──────────────────────────────────────────────
    if (status === 'Approved') {
      // Auto-create Shiprocket shipment and save AWB tracking info
      setImmediate(async () => {
        try {
          const fullOrderSnap = await orderRef.get();
          const fullOrder = fullOrderSnap.data() as Order;
          const sr = await createShiprocketShipment(fullOrder);
          await orderRef.update({
            shiprocketOrderId: sr.shiprocketOrderId,
            shiprocketShipmentId: sr.shiprocketShipmentId,
            awbCode: sr.awbCode,
            courierName: sr.courierName,
            trackingId: sr.awbCode || fullOrder.trackingId,
            trackingLink: sr.trackingLink || fullOrder.trackingLink,
          });
          console.log(`[Shiprocket] Shipment created for order ${orderData.orderId}: AWB=${sr.awbCode}`);
        } catch (srErr: any) {
          console.error('[Shiprocket] Failed to create shipment:', srErr.message);
          // Non-fatal — order is still approved
        }
      });
    }

    if (status === 'Rejected') {
      try {
        // Restore stock
        for (const item of orderData.items) {
          const productRef = db.collection('products').doc(String(item.productId));
          const productSnap = await productRef.get();
          if (productSnap.exists) {
            const currentStock = Number(productSnap.data()!.stock) || 0;
            await productRef.update({ stock: currentStock + item.qty });
          }
        }
        // Cancel Shiprocket shipment if one was created
        if (orderData.shiprocketOrderId) {
          await cancelShiprocketOrder(orderData.shiprocketOrderId);
        }
      } catch (err) {
        console.error('Failed to restore stock or cancel shipment on rejection:', err);
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
