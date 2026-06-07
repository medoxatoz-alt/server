// src/routes/cart.ts

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';

const router = Router();

// GET /api/cart  —  Get current user's cart
router.get('/', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  try {
    const snap = await db.collection('users').doc(uid).collection('cart').get();
    const items = snap.docs.map(d => ({ productId: d.id, ...d.data() }));
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

// POST /api/cart/:productId  —  Add or increment item
router.post('/:productId', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  const { productId } = req.params;
  try {
    const productRef = db.collection('products').doc(String(productId));
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const p = productSnap.data()!;
    const stock = Number(p.stock) || 0;

    const cartItemRef = db.collection('users').doc(uid).collection('cart').doc(String(productId));
    const existing = await cartItemRef.get();
    const currentQty = existing.exists ? (existing.data()!.quantity || 0) : 0;
    const targetQty = currentQty + 1;

    if (stock < targetQty) {
      res.status(400).json({ error: `Insufficient stock. Only ${stock} units available.` });
      return;
    }

    await cartItemRef.set({
      productId,
      quantity: targetQty,
      addedAt: new Date().toISOString(),
    }, { merge: true });
    res.json({ success: true, quantity: targetQty });
  } catch {
    res.status(500).json({ error: 'Failed to add to cart.' });
  }
});

// PATCH /api/cart/:productId  —  Set exact quantity
router.patch('/:productId', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  const { productId } = req.params;
  const { quantity } = req.body as { quantity: number };
  try {
    const cartItemRef = db.collection('users').doc(uid).collection('cart').doc(String(productId));
    if (quantity <= 0) {
      await cartItemRef.delete();
    } else {
      const productRef = db.collection('products').doc(String(productId));
      const productSnap = await productRef.get();
      if (!productSnap.exists) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const p = productSnap.data()!;
      const stock = Number(p.stock) || 0;

      if (stock < quantity) {
        res.status(400).json({ error: `Insufficient stock. Only ${stock} units available.` });
        return;
      }

      await cartItemRef.update({ quantity });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update cart.' });
  }
});

// DELETE /api/cart/:productId  —  Remove item
router.delete('/:productId', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  try {
    await db.collection('users').doc(uid).collection('cart').doc(String(req.params.productId)).delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove from cart.' });
  }
});

// DELETE /api/cart  —  Clear entire cart
router.delete('/', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  try {
    const snap = await db.collection('users').doc(uid).collection('cart').get();
    await Promise.all(snap.docs.map(d => d.ref.delete()));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear cart.' });
  }
});

export default router;
