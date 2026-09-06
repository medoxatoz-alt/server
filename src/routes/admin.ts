// src/routes/admin.ts
// Admin-only routes: users, reviews management

import { Router, Request, Response } from 'express';
import { db, auth } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// All admin routes require auth + admin role
router.use(verifyToken, requireAdmin);

// GET /api/admin/users  —  All registered users
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('users').get();
    res.json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// DELETE /api/admin/users/:uid
router.delete('/users/:uid', async (req: Request, res: Response) => {
  const uid = String(req.params.uid);
  try {
    await db.collection('users').doc(uid).delete();
    try {
      await auth.deleteUser(uid);
    } catch (err: any) {
      // Already gone from Auth (or never existed there) — not fatal.
      if (err?.code !== 'auth/user-not-found') {
        console.error('Failed to delete Firebase Auth user:', err);
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/admin/reviews  —  All product reviews
router.get('/reviews', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('reviews').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', async (req: Request, res: Response) => {
  try {
    await db.collection('reviews').doc(String(req.params.id)).delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete review.' });
  }
});

// GET /api/admin/admins  —  All admin users
router.get('/admins', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    res.json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch admins.' });
  }
});

export default router;
