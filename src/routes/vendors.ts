// src/routes/vendors.ts

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// GET /api/vendors/me  —  Vendor's own profile
router.get('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('vendors').doc(req.user!.uid).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Vendor profile not found.' });
      return;
    }
    res.json({ uid: snap.id, ...snap.data() });
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendor profile.' });
  }
});

// POST /api/vendors/register  —  Register as vendor
router.post('/register', verifyToken, async (req: Request, res: Response) => {
  try {
    const vendorRef = db.collection('vendors').doc(req.user!.uid);
    const existing = await vendorRef.get();
    if (existing.exists) {
      res.status(409).json({ error: 'Vendor profile already exists.' });
      return;
    }
    const vendorData = {
      ...req.body,
      uid: req.user!.uid,
      email: req.user!.email,
      role: 'vendor',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await vendorRef.set(vendorData);
    res.status(201).json({ success: true, vendor: vendorData });
  } catch {
    res.status(500).json({ error: 'Failed to register vendor.' });
  }
});

// PUT /api/vendors/me  —  Update own vendor profile
router.put('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const { email, phone, status, uid, role, createdAt, ...allowedUpdates } = req.body;
    await db.collection('vendors').doc(req.user!.uid).update(allowedUpdates);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update vendor profile.' });
  }
});

// GET /api/vendors  —  Admin: all vendors
router.get('/', verifyToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('vendors').get();
    res.json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendors.' });
  }
});

// GET /api/vendors/pending  —  Admin: pending vendors
router.get('/pending', verifyToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('vendors').where('status', '==', 'pending').get();
    res.json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch pending vendors.' });
  }
});

// PATCH /api/vendors/:uid/approve  —  Admin: approve vendor
router.patch('/:uid/approve', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.collection('vendors').doc(String(req.params.uid)).update({ status: 'approved' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to approve vendor.' });
  }
});

// PATCH /api/vendors/:uid/reject  —  Admin: reject vendor
router.patch('/:uid/reject', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.collection('vendors').doc(String(req.params.uid)).update({ status: 'rejected' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to reject vendor.' });
  }
});

// DELETE /api/vendors/:uid  —  Admin: delete vendor
router.delete('/:uid', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.collection('vendors').doc(String(req.params.uid)).delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete vendor.' });
  }
});

// GET /api/vendors/:uid  —  Fetch a single vendor profile
// Full profile (email/phone/GST/address) is only returned to the vendor
// themselves, an admin, or a buyer who has an actual order with this vendor.
// Everyone else gets a public-safe subset (no PII).
router.get('/:uid', verifyToken, async (req: Request, res: Response) => {
  try {
    const targetUid = String(req.params.uid);
    const snap = await db.collection('vendors').doc(targetUid).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Vendor profile not found.' });
      return;
    }
    const data = snap.data()!;

    const isSelfOrAdmin = req.user!.uid === targetUid || req.user!.role === 'admin';
    let canSeeFullProfile = isSelfOrAdmin;

    if (!canSeeFullProfile) {
      try {
        const orderSnap = await db.collection('orders')
          .where('customerId', '==', req.user!.uid)
          .where('vendorId', '==', targetUid)
          .limit(1)
          .get();
        canSeeFullProfile = !orderSnap.empty;
      } catch (err) {
        // If the composite index for (customerId, vendorId) isn't created yet,
        // fail safe to the public-safe subset rather than 500ing the request.
        console.error('Vendor-order lookup failed (composite index may be missing):', err);
        canSeeFullProfile = false;
      }
    }

    if (canSeeFullProfile) {
      res.json({ uid: snap.id, ...data });
    } else {
      res.json({
        uid: snap.id,
        storeName: data.storeName,
        status: data.status,
        createdAt: data.createdAt,
      });
    }
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendor profile.' });
  }
});

export default router;
