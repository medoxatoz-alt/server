  // src/routes/products.ts

  import { Router, Request, Response } from 'express';
  import { db } from '../firebase';
  import { verifyToken } from '../middleware/verifyToken';
  import { requireVendor } from '../middleware/requireVendor';
  import { requireAdmin } from '../middleware/requireAdmin';
  import { Product } from '../types';

  const router = Router();

  // GET /api/products  —  Public: all products
  // Pagination is opt-in via ?limit=&cursor= (cursor = last product id from the
  // previous page). Omitting them preserves the original "return everything"
  // behavior so existing callers are unaffected.
  router.get('/', async (req: Request, res: Response) => {
    try {
      const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
      const usePagination = !!limitParam && Number.isFinite(limitParam) && limitParam > 0;

      let query: FirebaseFirestore.Query = db.collection('products');
      if (usePagination) {
        query = query.orderBy('__name__').limit(limitParam!);
        if (cursor) query = query.startAfter(cursor);
      }

      const [snap, rejectedVendorsSnap] = await Promise.all([
        query.get(),
        db.collection('vendors').where('status', '==', 'rejected').get(),
      ]);
      const products: Product[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const rejectedVendorIds = new Set(rejectedVendorsSnap.docs.map(doc => doc.id));

      const searchParam = req.query.search ? String(req.query.search).toLowerCase() : undefined;

      // Filter out products of rejected vendors
      let filteredProducts = products.filter(p => !p.vendorId || !rejectedVendorIds.has(p.vendorId));

      if (searchParam) {
        filteredProducts = filteredProducts.filter(p => {
          const t = p.title?.toLowerCase() || '';
          const b = p.brand?.toLowerCase() || '';
          const sc = p.subCategoryId?.toLowerCase() || '';
          return t.includes(searchParam) || b.includes(searchParam)    || sc.includes(searchParam);
        });
      }

      if (usePagination) {
        const nextCursor = snap.docs.length === limitParam ? snap.docs[snap.docs.length - 1].id : null;
        res.json({ products: filteredProducts, nextCursor });
      } else {
        res.json(filteredProducts);
      }
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
      res.json({ ...productData, id: snap.id });
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
        vendorId: req.user!.uid,
        createdAt:   now,
        updatedAt:   now,
        images:      imagesArray,
        image:       thumbnail,         // backwards-compat single image field
        thumbnail,
        is_sold_by_vendor: req.user!.role !== 'admin',

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

      // ── Ownership check ──────────────────────────────────
      // A vendor may only edit their own products; admins may edit any.
      if (req.user!.role !== 'admin') {
        const existing = await productRef.get();
        if (!existing.exists) {
          res.status(404).json({ error: 'Product not found.' });
          return;
        }
        if (existing.data()?.vendorId !== req.user!.uid) {
          res.status(403).json({ error: 'You do not have permission to edit this product.' });
          return;
        }
        // Non-admins can never reassign ownership via the request body
        delete (body as any).vendorId;
      }

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
      const productId = String(req.params.id);
      
      // 1. Delete the product itself
      await db.collection('products').doc(productId).delete();

      // 2. Delete the product from all users' carts
      try {
        const cartsSnap = await db.collectionGroup('cart').where('productId', '==', productId).get();
        if (!cartsSnap.empty) {
          const batch = db.batch();
          cartsSnap.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (err: any) {
        console.warn('CollectionGroup query failed (index possibly missing). Falling back to iterating users...');
        // Fallback: iterate all users to delete the cart item manually
        const usersSnap = await db.collection('users').get();
        const batch = db.batch();
        let count = 0;
        for (const userDoc of usersSnap.docs) {
          batch.delete(userDoc.ref.collection('cart').doc(productId));
          count++;
          // Commit in chunks of 500 (Firestore batch limit)
          if (count % 500 === 0) {
            await batch.commit();
          }
        }
        if (count % 500 !== 0) {
          await batch.commit();
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete Product Error:', err);
      res.status(500).json({ error: 'Failed to delete product.' });
    }
  });

  export default router;
