import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';

const router = Router();

// ─────────────────────────────────────────────────────────
// ADDRESS ROUTES
// ─────────────────────────────────────────────────────────

const MAX_ADDRESSES = 5;

// Real server-side validation -- previously this endpoint accepted whatever
// shape the client sent with no checks at all.
function validateAddressInput(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Invalid address.';
  if (!body.fullName || !String(body.fullName).trim()) return 'Full name is required.';
  const phoneDigits = String(body.phone || '').replace(/\D/g, '');
  if (phoneDigits.length !== 10) return 'Please provide a valid 10-digit phone number.';
  if (!body.address || !String(body.address).trim()) return 'Address is required.';
  if (!body.city || !String(body.city).trim()) return 'City is required.';
  if (!body.state || !String(body.state).trim()) return 'State is required.';
  const pincodeDigits = String(body.pincode || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(pincodeDigits)) return 'Please provide a valid 6-digit pincode.';
  return null;
}

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
    const validationError = validateAddressInput(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const userRef = db.collection('users').doc(req.user!.uid);
    const snap = await userRef.get();
    const userAddresses: any[] = snap.exists ? (snap.data()!.addresses || []) : [];

    if (userAddresses.length >= MAX_ADDRESSES) {
      res.status(400).json({ error: `Maximum ${MAX_ADDRESSES} addresses allowed.` });
      return;
    }

    const newAddress = {
      fullName: String(req.body.fullName).trim(),
      phone: String(req.body.phone).replace(/\D/g, ''),
      address: String(req.body.address).trim(),
      city: String(req.body.city).trim(),
      state: String(req.body.state).trim(),
      pincode: String(req.body.pincode).replace(/\s/g, ''),
      id: Date.now().toString(),
      // The very first address a user saves becomes their default automatically
      // -- there's otherwise no way to have a default at all.
      isDefault: userAddresses.length === 0,
    };

    await userRef.set({
      addresses: admin.firestore.FieldValue.arrayUnion(newAddress)
    }, { merge: true });
    res.json({ success: true, address: newAddress });
  } catch {
    res.status(500).json({ error: 'Failed to save address' });
  }
});

// PATCH /api/user/addresses/:id/default -- mark one address as the default
router.patch('/addresses/:id/default', verifyToken, async (req: Request, res: Response) => {
  try {
    const userRef = db.collection('users').doc(req.user!.uid);
    const snap = await userRef.get();
    const addresses: any[] = snap.exists ? (snap.data()!.addresses || []) : [];

    if (!addresses.some(a => a.id === req.params.id)) {
      res.status(404).json({ error: 'Address not found.' });
      return;
    }

    const updated = addresses.map(a => ({ ...a, isDefault: a.id === req.params.id }));
    await userRef.set({ addresses: updated }, { merge: true });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

// DELETE /api/user/addresses/:id
router.delete('/addresses/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const userRef = db.collection('users').doc(req.user!.uid);
    const snap = await userRef.get();
    if (!snap.exists) { res.json({ success: true }); return; }

    const addresses: any[] = snap.data()!.addresses || [];
    const removed = addresses.find((a: any) => a.id === req.params.id);
    let filtered = addresses.filter((a: any) => a.id !== req.params.id);

    // If the deleted address was the default, promote another one so there's
    // always a default whenever at least one address remains.
    if (removed?.isDefault && filtered.length > 0 && !filtered.some((a: any) => a.isDefault)) {
      filtered = filtered.map((a: any, i: number) => (i === 0 ? { ...a, isDefault: true } : a));
    }

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
