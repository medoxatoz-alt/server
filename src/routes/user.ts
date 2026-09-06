import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';

const router = Router();

// ─────────────────────────────────────────────────────────
// ADDRESS ROUTES
// ─────────────────────────────────────────────────────────

// GET /api/user/addresses
router.get('/addresses', verifyToken, async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('users').doc(req.user!.uid).get();
    res.json(snap.exists ? (snap.data()!.addresses || []) : []);
  } catch {
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// POST /api/user/addresses
router.post('/addresses', verifyToken, async (req: Request, res: Response) => {
  try {
    const userRef = db.collection('users').doc(req.user!.uid);
    const snap = await userRef.get();
    const userAddresses = snap.exists ? (snap.data()!.addresses || []) : [];

    if (userAddresses.length >= 3) {
      res.status(400).json({ error: 'Maximum 3 addresses allowed.' });
      return;
    }

    const newAddress = req.body;
    await userRef.set({
      addresses: admin.firestore.FieldValue.arrayUnion({ ...newAddress, id: Date.now().toString() })
    }, { merge: true });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save address' });
  }
});

// DELETE /api/user/addresses/:id
router.delete('/addresses/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userRef = db.collection('users').doc(req.user!.uid);
    const snap = await userRef.get();
    if (!snap.exists) { res.json({ success: true }); return; }

    const addresses = snap.data()!.addresses || [];
    const filtered = addresses.filter((a: any) => a.id !== req.params.id);

    await userRef.set({ addresses: filtered }, { merge: true });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// ─────────────────────────────────────────────────────────
// WISHLIST ROUTES
// ─────────────────────────────────────────────────────────

// GET /api/user/wishlist
router.get('/wishlist', verifyToken, async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('users').doc(req.user!.uid).get();
    const wishlistIds: string[] = snap.exists ? (snap.data()!.wishlistIds || []) : [];
    res.json({ wishlistIds });
  } catch {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// POST /api/user/wishlist/:productId
router.post('/wishlist/:productId', verifyToken, async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  try {
    // Validate product exists
    const productSnap = await db.collection('products').doc(productId).get();
    if (!productSnap.exists) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const userRef = db.collection('users').doc(req.user!.uid);
    const userSnap = await userRef.get();
    const wishlistIds: string[] = userSnap.exists ? (userSnap.data()!.wishlistIds || []) : [];

    // Check for duplicate
    if (wishlistIds.includes(productId)) {
      res.status(400).json({ error: 'Product already in wishlist.' });
      return;
    }

    // Enforce max 10
    if (wishlistIds.length >= 10) {
      res.status(400).json({ error: 'Wishlist is full. Maximum 10 products allowed.' });
      return;
    }

    const updated = [...wishlistIds, productId];
    await userRef.set({ wishlistIds: updated }, { merge: true });
    res.json({ success: true, wishlistIds: updated });
  } catch {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /api/user/wishlist/:productId
router.delete('/wishlist/:productId', verifyToken, async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  try {
    const userRef = db.collection('users').doc(req.user!.uid);
    const userSnap = await userRef.get();
    const wishlistIds: string[] = userSnap.exists ? (userSnap.data()!.wishlistIds || []) : [];

    if (!wishlistIds.includes(productId)) {
      res.status(404).json({ error: 'Product not in wishlist.' });
      return;
    }

    const updated = wishlistIds.filter((id) => id !== productId);
    await userRef.set({ wishlistIds: updated }, { merge: true });
    res.json({ success: true, wishlistIds: updated });
  } catch {
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// PUT /api/user/profile — Update user profile details (like display name)
router.put('/profile', verifyToken, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    await db.collection('users').doc(req.user!.uid).update({ name });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update profile details.' });
  }
});

export default router;
