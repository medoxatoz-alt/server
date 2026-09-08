  // src/routes/products.ts

  import { Router, Request, Response } from 'express';
  import crypto from 'crypto';
  import * as admin from 'firebase-admin';
  import { db } from '../firebase';
  import { verifyToken } from '../middleware/verifyToken';
  import { requireVendor } from '../middleware/requireVendor';
  import { requireAdmin } from '../middleware/requireAdmin';
  import { Product, ProductVariant } from '../types';

  const router = Router();

  // Variants are now the only way price/mrp/stock/images are entered -- a
  // "simple" product is just one variant row; a product with sizes has more
  // than one. Normalises raw rows from the request body, throwing a
  // descriptive Error (caught by the route and turned into a 400) on any
  // invalid input, since there's no longer a base-field fallback to fall
  // back to.
  const MAX_VARIANT_IMAGES = 5;

  function normaliseVariants(raw: any): ProductVariant[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('At least one product option (price/stock) is required.');
    }

    const variants: ProductVariant[] = raw.map((v: any) => {
      const price = Math.max(0, Number(v?.price) || 0);
      if (!v?.price || price <= 0) {
        throw new Error('Every option needs a price greater than 0.');
      }
      const rawMrp = v.mrp !== undefined && v.mrp !== null && v.mrp !== '' ? Math.max(0, Number(v.mrp) || 0) : undefined;
      const images = Array.isArray(v.images)
        ? v.images.filter((img: any) => typeof img === 'string' && img.trim() !== '').slice(0, MAX_VARIANT_IMAGES)
        : undefined;
      // mrp/images omitted entirely (not set to `undefined`) when absent --
      // this array is written straight into the product document, and
      // Firestore rejects a write containing an explicit `undefined` at any
      // depth, including inside an array element like this one.
      return {
        id: typeof v.id === 'string' && v.id.trim() !== '' ? v.id : crypto.randomUUID(),
        label: typeof v.label === 'string' ? v.label.trim().slice(0, 100) : '',
        price,
        stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
        ...(rawMrp !== undefined ? { mrp: rawMrp } : {}),
        ...(images !== undefined ? { images } : {}),
      };
    });

    if (variants.length > 1) {
      const labels = variants.map(v => v.label.toLowerCase());
      if (labels.some(l => l === '')) {
        throw new Error('Please label each option so shoppers can tell them apart.');
      }
      if (new Set(labels).size !== labels.length) {
        throw new Error('Option labels must be unique.');
      }
    }

    return variants;
  }

  // The single place price/mrp/stock/images come from: the cheapest
  // variant's price/mrp, summed stock across all variants, and images taken
  // from the cheapest variant (or the first variant that has any). Every
  // screen that only reads the flat fields (ProductCard, admin/vendor
  // tables, search, wishlist) keeps working unchanged, whether the product
  // has one option or several.
  // `forMerge` distinguishes the two callers: POST builds a brand-new
  // document (a plain omitted key is enough), while PUT merges into an
  // existing one (an omitted key leaves whatever was already stored, so an
  // mrp that's no longer present on any variant must be explicitly cleared
  // with a delete sentinel instead).
  function applyVariantAggregate(data: Record<string, any>, variants: ProductVariant[], forMerge: boolean) {
    const cheapest = variants.reduce((min, v) => (v.price < min.price ? v : min), variants[0]);
    data.price = cheapest.price;
    if (cheapest.mrp !== undefined) {
      data.mrp = cheapest.mrp;
    } else if (forMerge) {
      data.mrp = admin.firestore.FieldValue.delete();
    }
    data.stock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

    const imageSource = cheapest.images && cheapest.images.length > 0
      ? cheapest
      : variants.find(v => v.images && v.images.length > 0);
    const images = imageSource?.images || [];
    data.images = images;
    data.image = images[0] || 'https://via.placeholder.com/200?text=No+Image';
    data.thumbnail = images[0] || data.image;
    data.variants = variants;
  }

  // "How to Use" resources -- one PDF (already uploaded via /api/upload/pdf,
  // so this just validates it's a plausible URL) plus up to 5 named links.
  // These belong to the product as a whole, never per-variant.
  const MAX_RESOURCE_LINKS = 5;

  function normaliseResourceLinks(raw: any): { label: string; url: string }[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l: any) => l && typeof l.url === 'string' && l.url.trim() !== '')
      .slice(0, MAX_RESOURCE_LINKS)
      .map((l: any) => {
        const url = String(l.url).trim();
        if (!/^https?:\/\//i.test(url)) {
          throw new Error('Links must start with http:// or https://');
        }
        const label = typeof l.label === 'string' && l.label.trim() !== '' ? l.label.trim().slice(0, 60) : 'Link';
        return { label, url };
      });
  }

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

      let variants: ProductVariant[];
      let resourceLinks: { label: string; url: string }[];
      try {
        variants = normaliseVariants(body.variants);
        resourceLinks = normaliseResourceLinks(body.resourceLinks);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }

      const data: Partial<Product> = {
        ...body,
        vendorId: req.user!.uid,
        createdAt:   now,
        updatedAt:   now,
        is_sold_by_vendor: req.user!.role !== 'admin',
      };
      delete (data as any).image;
      delete (data as any).images;
      delete (data as any).thumbnail;

      applyVariantAggregate(data, variants, false);

      data.resourceLinks = resourceLinks;
      if (typeof body.howToUsePdf === 'string' && body.howToUsePdf.trim()) {
        data.howToUsePdf = body.howToUsePdf.trim();
      } else {
        delete (data as any).howToUsePdf;
      }

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

      // Variants are the only source of price/mrp/stock/images now -- always
      // required, at least one row.
      let variants: ProductVariant[];
      let resourceLinks: { label: string; url: string }[];
      try {
        variants = normaliseVariants(body.variants);
        resourceLinks = normaliseResourceLinks(body.resourceLinks);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
      const variantsUpdate: Record<string, any> = {};
      applyVariantAggregate(variantsUpdate, variants, true);
      delete (body as any).variants;
      delete (body as any).image;
      delete (body as any).images;
      delete (body as any).thumbnail;

      // resourceLinks is always written as whatever survived validation
      // (possibly an empty array -- clearing all links). howToUsePdf is only
      // set when a real URL is present; an explicit empty string means the
      // form removed it, so the field is deleted outright ({merge:true}
      // would otherwise never clear it).
      const resourcesUpdate: Record<string, any> = { resourceLinks };
      if (typeof body.howToUsePdf === 'string' && body.howToUsePdf.trim()) {
        resourcesUpdate.howToUsePdf = body.howToUsePdf.trim();
      } else {
        resourcesUpdate.howToUsePdf = admin.firestore.FieldValue.delete();
      }
      delete (body as any).resourceLinks;
      delete (body as any).howToUsePdf;

      // Remove any undefined values that somehow snuck in
      const cleanBody = Object.fromEntries(
        Object.entries(body).filter(([_, v]) => v !== undefined && v !== null && !Number.isNaN(v))
      );

      await productRef.set({
        ...cleanBody,
        ...variantsUpdate,
        ...resourcesUpdate,
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
