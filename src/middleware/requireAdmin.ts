// src/middleware/requireAdmin.ts
import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!req.user || req.user.email.toLowerCase() !== adminEmail) {
    res.status(403).json({ error: 'Access denied. Admin only.' });
    return;
  }
  next();
}
