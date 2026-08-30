"use strict";
// src/firebase.ts
// Firebase Admin SDK initialized SERVER-SIDE
// Uses the serviceAccountKey.json for full admin privileges
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.db = exports.auth = void 0;
var admin = __importStar(require("firebase-admin"));
var dotenv_1 = __importDefault(require("dotenv"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
// Load the service account key
// 1. Try to load from environment variables (Priority)
var serviceAccount = null;
if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Replace literal '\n' strings with actual newlines because dotenv might not parse it if not fully handled
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
}
else {
    // 2. Fall back to serviceAccountKey.json if env vars are missing
    var serviceAccountPath = path_1.default.resolve(__dirname, '../serviceAccountKey.json');
    if (fs_1.default.existsSync(serviceAccountPath)) {
        serviceAccount = require(serviceAccountPath);
    }
    else {
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
exports.auth = admin.auth();
exports.db = admin.firestore();
exports.storage = admin.storage();
exports.default = admin;
