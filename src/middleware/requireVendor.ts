// src/middleware/requireVendor.ts
import { Request, Response, NextFunction } from 'express';

export function requireVendor(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const isAdmin = req.user.email.toLowerCase() === adminEmail;
  const isVendor = req.user.role === 'vendor' && req.user.status === 'approved';

  if (!isAdmin && !isVendor) {
    res.status(403).json({ error: 'Access denied. Approved vendors and admins only.' });
    return;
  }
  next();
}
