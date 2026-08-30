// src/index.ts — MedoxAtoZ Express Server

import dotenv from 'dotenv';
dotenv.config();

// ─── Required env vars ───────────────────────────────────────────────────────
// Fail fast and loud at startup rather than silently falling back to an
// insecure default (e.g. a hardcoded JWT secret) at request time.
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'ADMIN_EMAIL',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'CASHFREE_APP_ID',
  'CASHFREE_SECRET_KEY',
];
const missingEnvVars = REQUIRED_ENV_VARS.filter(name => !process.env[name]);
if (missingEnvVars.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes     from './routes/auth';
import productRoutes  from './routes/products';
import cartRoutes     from './routes/cart';
import orderRoutes    from './routes/orders';
import vendorRoutes   from './routes/vendors';
import adminRoutes    from './routes/admin';
import uploadRoutes   from './routes/upload';
import userRoutes     from './routes/user';
import paymentRoutes  from './routes/payments';
import shiprocketRoutes from './routes/shiprocket';
import categoriesRoutes from './routes/categories';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = FRONTEND_URL.split(',').map(o => o.trim());

// Trust proxy is required for Railway/Heroku to allow secure cookies behind their load balancers
app.set('trust proxy', 1);

// ─── Security Headers ───────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:3000')) {
      callback(null, true);
    } else {
      console.error(`[Server Error] Not allowed by CORS. Origin: "${origin}". Allowed:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,           // allow cookies cross-origin (dev and prod)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Body Parsers ────────────────────────────────────────────────────────────
// The verify callback stashes the raw body string on req so Cashfree webhook
// signature verification can use it (HMAC is computed over the raw payload).
app.use(express.json({
  limit: '2mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/products',    productRoutes);
app.use('/api/cart',        cartRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/vendors',     vendorRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/upload',      uploadRoutes);
app.use('/api/user',        userRoutes);
app.use('/api/payments',    paymentRoutes);
app.use('/api/shipment',    shiprocketRoutes);
app.use('/api/categories',  categoriesRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  require('fs').appendFile('error.log', new Date().toISOString() + ' ' + err.stack + '\n', () => {});
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ MedoxAtoZ server running on http://localhost:${PORT}`);
  console.log(`   Firebase config loaded from .env (NOT exposed to browser)`);
});

export default app;
