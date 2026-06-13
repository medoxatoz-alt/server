// src/middleware/requireVendor.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../firebase';

export async function requireVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const isAdmin = req.user.email.toLowerCase() === adminEmail;

  if (isAdmin) {
    next();
    return;
  }

  try {
    const vendorSnap = await db.collection('vendors').doc(req.user.uid).get();
    if (vendorSnap.exists) {
      const vdata = vendorSnap.data()!;
      if (vdata.status === 'approved') {
        next();
        return;
      }
    }
  } catch (err) {
    console.error('Error verifying vendor status in DB:', err);
    res.status(500).json({ error: 'Internal server error during verification.' });
    return;
  }

  res.status(403).json({ error: 'Access denied. Approved vendors and admins only.' });
}
