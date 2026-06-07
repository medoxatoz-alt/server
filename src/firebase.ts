// src/firebase.ts
// Firebase Admin SDK initialized SERVER-SIDE
// Uses the serviceAccountKey.json for full admin privileges

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Load the service account key
// 1. Try to load from environment variables (Priority)
let serviceAccount: any = null;

if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    // Replace literal '\n' strings with actual newlines because dotenv might not parse it if not fully handled
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
} else {
  // 2. Fall back to serviceAccountKey.json if env vars are missing
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
  } else {
    console.warn('WARNING: Firebase Admin credentials not found in .env or serviceAccountKey.json!');
  }
}

// Prevent re-initialization on hot-reload
if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'medoxatoz-3104c.firebasestorage.app'
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();
export default admin;
