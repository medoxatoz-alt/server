// src/routes/orders.ts

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { Order, OrderItem } from '../types';
import { createShiprocketShipment, cancelShiprocketOrder } from '../utils/shiprocket';
import { restoreStock } from '../utils/variantStock';
import axios from 'axios';



const router = Router();

// ─────────────────────────────────────────────────────────
// STATUS TRANSITION VALIDATOR
// ─────────────────────────────────────────────────────────
// No 'Rejected' transition -- cancellation (POST /:id/cancel) is the only
// way an order can end besides being delivered. 'Rejected' stays a valid
// value on historical documents (see the Order type), just nothing can
// write it anymore. 'Cancellation Requested' is dropped too: only a vendor
// or admin can ever PATCH an order (see canManageOrder below) -- there was
// never a way for a customer to request cancellation, so this state was
// unreachable dead weight; the real cancel flow (POST /:id/cancel) already
// goes straight from Approved to Cancelled in one step.
const VALID_TRANSITIONS: Record<string, string[]> = {
  Approved: ['Delivered'],
  Delivered: [],    // Terminal state
  Cancelled: [],    // Terminal state
};

function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// An order can be acted on by the vendor who owns it, or by an admin acting
// on an admin-owned order -- never by an admin on a specific vendor's order.
//
// vendorId is ALWAYS a real Firebase uid on both sides (a vendor's own uid,
// or the creating admin's own uid for admin-listed products) -- there is no
// literal 'admin' sentinel actually written anywhere by products.ts, so
// checking for that string was a no-op bug.
//
// A vendor can only ever manage their own orders (uid match, no DB read
// needed -- unambiguous). For an admin, trust the `sellerIsAdmin` flag
// snapshotted onto the order at creation time when present (fast path, lets
// *any* admin manage an admin-owned order, not just the one who happened to
// create the product). Orders placed before that flag existed fall back to
// authoritatively looking up the actual role of whoever owns `vendorId` --
// this is the real source of truth, not another string-matching guess.
async function canManageOrder(orderData: { vendorId: string; sellerIsAdmin?: boolean }, user: { uid: string; role: string }): Promise<boolean> {
  if (user.role !== 'admin') return orderData.vendorId === user.uid;
  if (orderData.sellerIsAdmin !== undefined) return orderData.sellerIsAdmin;
  if (!orderData.vendorId || orderData.vendorId === user.uid) return true;
  const ownerSnap = await db.collection('users').doc(orderData.vendorId).get();
  return ownerSnap.exists && ownerSnap.data()?.role === 'admin';
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
          status: 'Approved',
          paymentMethod: paymentMethod || 'Cash on Delivery (COD)',
          createdAt: timestamp,
          timeline: [{ status: 'Approved', timestamp }],
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
            if (err.response) {
              console.error('[Shiprocket] Response Data:', JSON.stringify(err.response.data, null, 2));
            }
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
// The only reachable transition today is Approved -> Delivered (orders are
// created directly with status 'Approved', and nothing in VALID_TRANSITIONS
// leads back into 'Approved'), so there are no post-update side effects to
// run here anymore -- Shiprocket shipment creation now happens once, at
// order-creation time (orders.ts POST '/', payments.ts webhook/verify).
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

    // ── Ownership check ──────────────────────────────────
    if (!(await canManageOrder(orderData as { vendorId: string }, req.user!))) {
      res.status(403).json({
        error: 'Unauthorized. Only the creator who owns this order can update it.',
      });
      return;
    }

    // ── Atomic transition + update ────────────────────────
    // Reading currentStatus and writing the new one inside the same
    // transaction (rather than the previous get-then-update) closes a race
    // where two concurrent PATCH calls could both read the same
    // pre-transition status and both apply the transition, appending a
    // duplicate timeline entry.
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists) return { ok: false as const, currentStatus: undefined };
      const currentStatus: string = snap.data()!.status;
      if (!isValidTransition(currentStatus, status)) return { ok: false as const, currentStatus };

      const timestamp = new Date().toISOString();
      transaction.update(orderRef, {
        status,
        [`${status.toLowerCase()}At`]: timestamp,
        timeline: admin.firestore.FieldValue.arrayUnion({ status, timestamp }),
      });
      return { ok: true as const, currentStatus };
    });

    if (!result.ok) {
      const currentStatus = result.currentStatus;
      if (currentStatus === undefined) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      res.status(400).json({
        error: `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${(VALID_TRANSITIONS[currentStatus] || []).join(', ') || 'none (terminal state)'}`,
      });
      return;
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

    // Atomically claim the delete (read status + delete the doc in one
    // transaction) so two concurrent deletes of the same order can't both
    // read status === 'Approved' and both restore stock. Only the winner
    // gets a non-null `items` back.
    const items = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists) return null;
      const orderData = snap.data()!;
      transaction.delete(orderRef);
      return orderData.status === 'Approved' ? (orderData.items as OrderItem[]) : [];
    });

    if (items && items.length > 0) {
      try {
        await restoreStock(items);
      } catch (err) {
        console.error("Failed to restore stock on order deletion:", err);
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete order.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/orders/:id/cancel
// ─────────────────────────────────────────────────────────
router.post('/:id/cancel', verifyToken, async (req: Request, res: Response) => {
  try {
    const orderRef = db.collection('orders').doc(String(req.params.id));
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const orderData = orderSnap.data() as Order;

    // Auth Check
    if (!(await canManageOrder(orderData as { vendorId: string }, req.user!))) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    // Atomically claim the cancellation by flipping status inside a
    // transaction *before* touching Shiprocket/Cashfree/stock. Two
    // concurrent cancel requests (double-click, a client retry) would
    // otherwise both read status === 'Approved' via a plain .get() and both
    // run the refund + stock-restore side effects -- a real double-refund
    // risk. Only the request that wins this transaction proceeds; the loser
    // sees the already-flipped status and bails before any side effect runs.
    const claimed = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists || snap.data()?.status !== 'Approved') return false;
      transaction.update(orderRef, {
        status: 'Cancelled',
        timeline: admin.firestore.FieldValue.arrayUnion({
          status: 'Cancelled',
          timestamp: new Date().toISOString()
        })
      });
      return true;
    });

    if (!claimed) {
      res.status(400).json({ error: 'Order cannot be cancelled.' });
      return;
    }

    // 1. Cancel Shiprocket Order
    if (orderData.shiprocketOrderId) {
      try {
        await cancelShiprocketOrder(orderData.shiprocketOrderId);
      } catch (err) {
        console.error('Failed to cancel Shiprocket shipment:', err);
      }
    }

    // 2. Cashfree Refund
    if (orderData.cashfreeOrderId && orderData.paymentMethod !== 'COD') {
      try {
        const cfEnvironment = process.env.CASHFREE_ENV === 'PRODUCTION'
          ? 'https://api.cashfree.com/pg'
          : 'https://sandbox.cashfree.com/pg';
          
        await axios.post(`${cfEnvironment}/orders/${orderData.cashfreeOrderId}/refunds`, {
          refund_amount: orderData.totalAmount,
          refund_id: `ref_${orderData.orderId}_${Date.now()}`,
          refund_note: "Cancelled via Dashboard"
        }, {
          headers: {
            'x-client-id': process.env.CASHFREE_APP_ID,
            'x-client-secret': process.env.CASHFREE_SECRET_KEY,
            'x-api-version': '2022-09-01'
          }
        });
        console.log(`[Cashfree] Refund initiated for ${orderData.cashfreeOrderId}`);
      } catch (err: any) {
        console.error('[Cashfree] Failed to initiate refund:', err?.response?.data || err.message);
      }
    }

    // 3. Restore Stock
    await restoreStock(orderData.items as OrderItem[]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
});

export default router;
