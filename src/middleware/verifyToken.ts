// src/middleware/verifyToken.ts
// Reads the JWT session cookie, verifies it, and attaches req.user

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserSession } from '../types';

const JWT_SECRET = process.env.JWT_SECRET!;

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.medox_token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated. Please sign in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserSession;
    req.user = decoded;
    next();
  } catch {
    res.clearCookie('medox_token');
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
