// src/routes/cart.ts

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { resolveEffectiveVariant } from '../utils/variantResolution';

const router = Router();

// Cart docs are keyed by productId alone for a plain product (unchanged from
// before variants existed), or `${productId}__${variantId}` when a specific
// variant is in the cart -- letting two variants of the same product sit as
// separate lines without disturbing the existing single-variant doc id.
function cartDocId(productId: string, variantId?: string) {
  return variantId ? `${productId}__${variantId}` : productId;
}

// GET /api/cart  —  Get current user's cart
router.get('/', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  try {
    const snap = await db.collection('users').doc(uid).collection('cart').get();
    const items = snap.docs.map(d => ({ productId: d.data().productId, ...d.data() }));
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

// POST /api/cart/:productId  —  Add or increment item
router.post('/:productId', verifyToken, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  const { productId } = req.params;
  const variantId: string | undefined = typeof req.body?.variantId === 'string' && req.body.variantId.trim() !== '' ? req.body.variantId : undefined;
  try {
    const productRef = db.collection('products').doc(String(productId));
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const p = productSnap.data()!;
    const target = resolveEffectiveVariant(p, variantId);
    if (!target) {
      res.status(404).json({ error: 'Product variant not found.' });
      return;
    }
    const stock = target.stock;

    const docId = cartDocId(String(productId), variantId);
    const cartItemRef = db.collection('users').doc(uid).collection('cart').doc(docId);
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
      ...(variantId ? { variantId } : {}),
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
  const variantId: string | undefined = typeof req.query.variantId === 'string' && req.query.variantId.trim() !== '' ? req.query.variantId : undefined;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    res.status(400).json({ error: 'Quantity must be a valid number.' });
    return;
  }
  try {
    const docId = cartDocId(String(productId), variantId);
    const cartItemRef = db.collection('users').doc(uid).collection('cart').doc(docId);
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
      const target = resolveEffectiveVariant(p, variantId);
      if (!target) {
        res.status(404).json({ error: 'Product variant not found.' });
        return;
      }
      const stock = target.stock;

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
  const variantId: string | undefined = typeof req.query.variantId === 'string' && req.query.variantId.trim() !== '' ? req.query.variantId : undefined;
  try {
    const docId = cartDocId(String(req.params.productId), variantId);
    await db.collection('users').doc(uid).collection('cart').doc(docId).delete();
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
