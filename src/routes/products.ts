// src/routes/products.ts

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireVendor } from '../middleware/requireVendor';
import { requireAdmin } from '../middleware/requireAdmin';
import { Product } from '../types';

const router = Router();

// GET /api/products  —  Public: all products
router.get('/', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('products').get();
    const products: Product[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));

    // Fetch all rejected vendors
    const rejectedVendorsSnap = await db.collection('vendors').where('status', '==', 'rejected').get();
    const rejectedVendorIds = new Set(rejectedVendorsSnap.docs.map(doc => doc.id));

    // Filter out products of rejected vendors
    const filteredProducts = products.filter(p => !p.vendorId || !rejectedVendorIds.has(p.vendorId));
    res.json(filteredProducts);
  } catch {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// POST /api/products/bulk  —  Public: fetch multiple products by IDs (for wishlist etc.)
router.post('/bulk', async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.json([]);
    return;
  }
  try {
    const fetches = ids.map(id => db.collection('products').doc(id).get());
    const snaps = await Promise.all(fetches);
    const products = snaps
      .filter(s => s.exists)
      .map(s => ({ id: s.id, ...s.data() } as Product));

    // Fetch all rejected vendors
    const rejectedVendorsSnap = await db.collection('vendors').where('status', '==', 'rejected').get();
    const rejectedVendorIds = new Set(rejectedVendorsSnap.docs.map(doc => doc.id));

    // Filter out products of rejected vendors
    const filteredProducts = products.filter(p => !p.vendorId || !rejectedVendorIds.has(p.vendorId));
    res.json(filteredProducts);
  } catch {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// GET /api/products/:id  —  Public: single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('products').doc(String(req.params.id)).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const productData = snap.data() as Product;
    const vendorId = productData.vendorId;
    if (vendorId && vendorId !== 'admin') {
      const vendorSnap = await db.collection('vendors').doc(vendorId).get();
      if (vendorSnap.exists && vendorSnap.data()?.status === 'rejected') {
        res.status(403).json({ error: 'Vendor is no longer available' });
        return;
      }
    }
    res.json({ id: snap.id, ...productData });
  } catch {
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// GET /api/products/vendor/:vendorId  —  Vendor's own products
router.get('/vendor/:vendorId', verifyToken, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin' && req.params.vendorId === req.user!.uid;
    const vendorIds = isAdmin ? [req.user!.uid, 'admin'] : [req.params.vendorId];
    
    const snap = await db.collection('products').where('vendorId', 'in', vendorIds).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch vendor products.' });
  }
});

// POST /api/products  —  Add product (vendor/admin)
router.post('/', verifyToken, requireVendor, async (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const body = req.body;

    // Normalise images: support both `images` (array) and legacy `image` (string)
    const imagesArray: string[] = Array.isArray(body.images) && body.images.length > 0
      ? body.images
      : body.image
        ? [body.image]
        : [];

    const thumbnail: string = body.thumbnail || imagesArray[0] || '';

    const data: Partial<Product> = {
      ...body,
      vendorId:    req.user!.uid,
      createdAt:   now,
      updatedAt:   now,
      images:      imagesArray,
      image:       thumbnail,         // backwards-compat single image field
      thumbnail,
      userReviews: body.userReviews ?? [],
      rating:      body.rating      ?? 0,
      reviewCount: body.reviewCount ?? 0,
      stock:       Number(body.stock ?? 10),
    };

    const ref = await db.collection('products').add(data);
    await ref.update({ id: ref.id });
    res.status(201).json({ id: ref.id, ...data });
  } catch {
    res.status(500).json({ error: 'Failed to create product.' });
  }
});


// PUT /api/products/:id  —  Update product (vendor/admin)
router.put('/:id', verifyToken, requireVendor, async (req: Request, res: Response) => {
  try {
    const productRef = db.collection('products').doc(String(req.params.id));
    const body = req.body;

    // Re-normalise images on edit too
    const rawImagesArray = Array.isArray(body.images) && body.images.length > 0
      ? body.images
      : Array.isArray(body.image) ? body.image : body.image ? [body.image] : [];
    
    // Ensure it's a flat array of strings
    const imagesArray: string[] = rawImagesArray.flat().filter((img: any) => typeof img === 'string' && img.trim() !== '');

    const thumbnail: string = typeof body.thumbnail === 'string' && body.thumbnail.trim() !== ''
        ? body.thumbnail 
        : imagesArray[0] || '';

    // Remove any undefined values that somehow snuck in
    const cleanBody = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== undefined && v !== null && !Number.isNaN(v))
    );

    await productRef.set({
      ...cleanBody,
      images: imagesArray,
      image:  thumbnail,
      thumbnail,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update Product Error:', err);
    res.status(500).json({ error: 'Failed to update product.', details: err.message });
  }
});

// DELETE /api/products/:id  —  Delete product (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.collection('products').doc(String(req.params.id)).delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

export default router;
