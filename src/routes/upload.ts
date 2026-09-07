// src/routes/upload.ts
// Image upload to Firebase Storage (server-side, via admin SDK)

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storage } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireVendor } from '../middleware/requireVendor';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Store file in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// Magic-byte check so a renamed/relabeled non-image file can't slip past the
// mimetype header alone (which the client controls).
function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF87a / GIF89a
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return true;
  // WEBP (RIFF....WEBP)
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true;
  return false;
}

// PDF files start with the "%PDF-" signature.
function isValidPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
}

async function uploadToFirebase(fileBuffer: Buffer, mimetype: string, originalName: string, folder: string = 'products'): Promise<string> {
  const ext = originalName.split('.').pop() || 'jpg';
  const filePath = `${folder}/${uuidv4()}.${ext}`;
  const bucket = storage.bucket();
  const file = bucket.file(filePath);
  const downloadToken = uuidv4();

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimetype,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
}

// POST /api/upload/image  —  Upload single product image
router.post(
  '/image',
  verifyToken,
  requireVendor,
  upload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    if (!isValidImageBuffer(req.file.buffer)) {
      res.status(400).json({ error: 'File does not appear to be a valid image.' });
      return;
    }

    try {
      const downloadURL = await uploadToFirebase(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.json({ url: downloadURL });
    } catch (err) {
      console.error('Image upload failed:', err);
      res.status(500).json({ error: 'Image upload failed.' });
    }
  }
);

// POST /api/upload/images  —  Upload multiple images (up to 5)
router.post(
  '/images',
  verifyToken,
  requireVendor,
  upload.array('images', 5),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No images provided.' });
      return;
    }
    if (files.some(f => !isValidImageBuffer(f.buffer))) {
      res.status(400).json({ error: 'One or more files do not appear to be valid images.' });
      return;
    }

    try {
      const uploads = files.map((file) => uploadToFirebase(file.buffer, file.mimetype, file.originalname));
      const urls = await Promise.all(uploads);
      res.json({ urls });
    } catch (err) {
      console.error('Multiple image upload failed:', err);
      res.status(500).json({ error: 'Image upload failed.' });
    }
  }
);

// POST /api/upload/pdf  —  Upload a "How to Use" PDF for a product
router.post(
  '/pdf',
  verifyToken,
  requireVendor,
  uploadPdf.single('pdf'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided.' });
      return;
    }
    if (!isValidPdfBuffer(req.file.buffer)) {
      res.status(400).json({ error: 'File does not appear to be a valid PDF.' });
      return;
    }

    try {
      const downloadURL = await uploadToFirebase(req.file.buffer, req.file.mimetype, req.file.originalname, 'product-guides');
      res.json({ url: downloadURL });
    } catch (err) {
      console.error('PDF upload failed:', err);
      res.status(500).json({ error: 'PDF upload failed.' });
    }
  }
);

export default router;
