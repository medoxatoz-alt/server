// src/routes/auth.ts
// Handles login (email/password + phone OTP), logout, and /me

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { auth, db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { UserSession } from '../types';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// Helper: resolve role from Firestore
async function resolveRole(uid: string, email: string): Promise<UserSession> {
  const lowerEmail = email.toLowerCase();

  if (lowerEmail === ADMIN_EMAIL) {
    const adminSnap = await db.collection('users').doc(uid).get();
    return { uid, email, role: 'admin', phone: adminSnap.exists ? adminSnap.data()!.phone : '' };
  }

  // Check vendor collection
  const vendorSnap = await db.collection('vendors').doc(uid).get();
  if (vendorSnap.exists) {
    const vdata = vendorSnap.data()!;
    return {
      uid,
      email,
      name: vdata.storeName || vdata.name,
      phone: vdata.phone || '',
      role: 'vendor',
      status: vdata.status ?? 'pending',
    };
  }

  // Default buyer
  const userSnap = await db.collection('users').doc(uid).get();
  const udata = userSnap.exists ? userSnap.data()! : {};
  return {
    uid,
    email,
    name: udata.name,
    phone: udata.phone || '',
    role: 'buyer',
  };
}

// POST /api/auth/register  —  Email + Password Register
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });
    
    const uid = userRecord.uid;
    const userEmail = userRecord.email!;
    const lowerEmail = userEmail.toLowerCase();

    // Create user document in Firestore. Role must match the same ADMIN_EMAIL
    // check every other auth path (login, verify, resolveRole) uses -- this used
    // to always write 'buyer' even for the admin email, leaving the Firestore doc
    // out of sync with the role resolveRole() would report for the same account.
    await db.collection('users').doc(uid).set({
      name,
      email: lowerEmail,
      phone: '',
      role: lowerEmail === ADMIN_EMAIL ? 'admin' : 'buyer',
      createdAt: new Date().toISOString(),
    });

    // Don't log the user in yet -- the Admin SDK can create the account but can't
    // send mail itself, so the client signs in just long enough to trigger
    // Firebase's own verification email, then calls /auth/login once it's confirmed.
    res.status(201).json({ success: true, requiresVerification: true });
  } catch (err: any) {
    console.error('Register error:', err);
    const code = err.code;
    let msg = 'Registration failed. Please try again.';
    if (code === 'auth/email-already-exists') {
      msg = 'This email address is already registered.';
    } else if (code === 'auth/invalid-password') {
      msg = 'Password should be at least 6 characters.';
    } else if (code === 'auth/invalid-email') {
      msg = 'Invalid email address format.';
    }
    res.status(400).json({ error: msg });
  }
});

// POST /api/auth/login  —  Email + Password
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    // Admin SDK cannot sign in users, so we use the Auth REST API to verify credentials
    const apiKey = process.env.FIREBASE_API_KEY;
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data: any = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const uid = data.localId;
    const userEmail = (data.email as string).toLowerCase();

    // The REST sign-in call above only checks the password. Email verification
    // status has to come from the Admin SDK (the same source resolveRole/register
    // trust), applied uniformly -- including to the admin account, which is why
    // scripts/verify-admin-email.js exists to bootstrap it rather than the code
    // special-casing ADMIN_EMAIL around this check.
    const userRecord = await auth.getUser(uid);
    if (!userRecord.emailVerified) {
      res.status(403).json({
        error: 'Please verify your email before signing in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    // Admin bypass: if this is the admin email, ensure the Firestore doc exists
    if (userEmail === ADMIN_EMAIL) {
      const adminRef = db.collection('users').doc(uid);
      const adminSnap = await adminRef.get();
      if (!adminSnap.exists) {
        await adminRef.set({
          name: 'Admin',
          email: userEmail,
          phone: '',
          role: 'admin',
          createdAt: new Date().toISOString(),
        });
      }
    }

    const session = await resolveRole(uid, userEmail);
    const token = jwt.sign(session, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('medox_token', token, COOKIE_OPTS);
    res.json({ success: true, user: session });
  } catch (err: any) {
    const msg = err.message.includes('INVALID_LOGIN_CREDENTIALS')
        ? 'Incorrect email or password.'
        : err.message.includes('TOO_MANY_ATTEMPTS')
        ? 'Too many attempts. Try again later.'
        : 'Login failed. Please try again.';
    res.status(401).json({ error: msg });
  }
});

// POST /api/auth/verify  —  Verify Firebase ID Token (from phone OTP) and create session
router.post('/verify', async (req: Request, res: Response) => {
  const { idToken, name, isSignup } = req.body as { idToken: string; name?: string; isSignup?: boolean };

  if (!idToken) {
    res.status(400).json({ error: 'Firebase ID token is required.' });
    return;
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userRecord = await auth.getUser(uid);

    const email = userRecord.email || `${userRecord.phoneNumber}@phone.auth.medox`; // Fallback for phone auth without email
    const displayName = userRecord.displayName || 'User';

    const userRef = db.collection('users').doc(uid);
    const vendorRef = db.collection('vendors').doc(uid);

    const [userSnap, vendorSnap] = await Promise.all([
      userRef.get(),
      vendorRef.get(),
    ]);

    const exists = userSnap.exists || vendorSnap.exists;
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL;

    if (!exists) {
      if (isSignup || isAdmin) {
        // Auto-create document for new users signing up, OR always for the admin email
        await userRef.set({
          name: name || displayName,
          email,
          phone: userRecord.phoneNumber || '',
          role: isAdmin ? 'admin' : 'buyer',
          createdAt: new Date().toISOString(),
        });
      } else {
        res.status(404).json({ error: 'User record not found. Please sign up first.', code: 'USER_NOT_FOUND' });
        return;
      }
    } else if (isSignup && name && !isAdmin) {
      if (userSnap.exists) {
        await userRef.set({ name }, { merge: true });
      } else if (vendorSnap.exists) {
        await vendorRef.set({ storeName: name }, { merge: true });
      }
    }

    const session = await resolveRole(uid, email);
    const token = jwt.sign(session, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('medox_token', token, COOKIE_OPTS);
    res.json({ success: true, user: session });
  } catch (err: any) {
    console.error('Verify error:', err);
    res.status(401).json({ error: 'Authentication failed. Invalid token.' });
  }
});

// POST /api/auth/verify-phone — Verify phone OTP ID Token and link it to current user
router.post('/verify-phone', verifyToken, async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken: string };
  if (!idToken) {
    res.status(400).json({ error: 'Firebase ID token is required.' });
    return;
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
      res.status(400).json({ error: 'No phone number found in token.' });
      return;
    }

    const uid = req.user!.uid;

    // Update in Firestore based on role
    if (req.user!.role === 'vendor') {
      await db.collection('vendors').doc(uid).set({ phone: phoneNumber }, { merge: true });
    } else {
      await db.collection('users').doc(uid).set({ phone: phoneNumber }, { merge: true });
    }

    // Generate new session token
    const session = await resolveRole(uid, req.user!.email);
    const token = jwt.sign(session, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('medox_token', token, COOKIE_OPTS);
    res.json({ success: true, user: session, phone: phoneNumber });
  } catch (err: any) {
    console.error('Verify phone error:', err);
    res.status(401).json({ error: 'Failed to verify phone token.' });
  }
});
router.get('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const session = await resolveRole(req.user!.uid, req.user!.email);
    res.json({ user: session });
  } catch {
    res.status(500).json({ error: 'Failed to refresh session.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('medox_token', { 
    path: '/',
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
  res.json({ success: true });
});

export default router;
