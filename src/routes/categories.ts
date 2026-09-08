import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// Define the 9 strictly hardcoded Main Categories with IDs
export const MAIN_CATEGORIES = [
  { id: 'skin-hair-care', name: 'Skin & Hair Care' },
  { id: 'dermatology-equipment', name: 'Dermatology Equipment' },
  { id: 'makeup-beauty', name: 'Makeup & Beauty Products' },
  
  { id: 'medical-products', name: 'All Hosp Dept Wise Products' },
  { id: 'surgical-products', name: 'Surgical Products' },

  { id: 'diagnostic-products', name: 'Diagnostic Products' },
    { id: 'health-wellness', name: 'Health & Wellness Products' },
  { id: 'home-lifestyle', name: 'Home & Lifestyle' },
  { id: 'puja-items', name: 'Healing Puja Products' }
];

const subcategoriesRef = db.collection('subcategories');

// ─────────────────────────────────────────────────────────
// GET /api/categories
// Returns the mapping of Main Category -> Subcategories
// ─────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const snap = await subcategoriesRef.get();
    
    // We map mainCategoryId -> array of subcategory objects {id, name}
    const subcategories: Record<string, {id: string, name: string}[]> = {};
    const subcategoryDocs: any[] = [];
    
    // Initialize empty arrays for all main categories
    MAIN_CATEGORIES.forEach(cat => {
      subcategories[cat.id] = [];
    });

    snap.forEach(doc => {
      const data = doc.data();
      subcategoryDocs.push({ id: doc.id, ...data });
    });

    // Sort by order (default to 0) then by name
    subcategoryDocs.sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    subcategoryDocs.forEach(doc => {
      if (doc.mainCategoryId && subcategories[doc.mainCategoryId] !== undefined) {
        subcategories[doc.mainCategoryId].push({ id: doc.id, name: doc.name });
      }
    });

    res.json({
      mainCategories: MAIN_CATEGORIES,
      subcategories,
      docs: subcategoryDocs // full docs for admin page
    });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/categories/sub
// Admin creates a subcategory document
// ─────────────────────────────────────────────────────────
router.post('/sub', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mainCategoryId, name } = req.body;
    
    const isValidMainCat = MAIN_CATEGORIES.some(cat => cat.id === mainCategoryId);
    if (!isValidMainCat) {
      res.status(400).json({ error: 'Invalid main category ID' });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const docRef = await subcategoriesRef.add({
      mainCategoryId,
      name: name.trim(),
      order: Date.now(), // default order so it appears at the end
      createdAt: new Date().toISOString()
    });
    
    res.status(201).json({ success: true, id: docRef.id, mainCategoryId, name: name.trim(), order: Date.now() });
  } catch (error) {
    console.error('Failed to create subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/categories/sub/:id
// Admin renames a subcategory document
// ─────────────────────────────────────────────────────────
router.put('/sub/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body as { name?: string };

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const subDoc = await subcategoriesRef.doc(id).get();
    if (!subDoc.exists) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }

    const trimmedName = name.trim();
    await subcategoriesRef.doc(id).update({ name: trimmedName });

    res.json({ success: true, id, name: trimmedName });
  } catch (error) {
    console.error('Failed to rename subcategory:', error);
    res.status(500).json({ error: 'Failed to rename subcategory' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/categories/sub/:id
// Admin deletes a subcategory document
// ─────────────────────────────────────────────────────────
router.delete('/sub/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const subDoc = await subcategoriesRef.doc(id).get();
    if (!subDoc.exists) {
      res.status(404).json({ error: 'Subcategory not found' });
      return;
    }
    const subName = subDoc.data()?.name;

    const { db } = require('../firebase');
    const productsRef = db.collection('products');
    
    // Check by ID
    const productsSnap = await productsRef.where('subCategoryId', '==', id).limit(1).get();
    
    // Check by Name (legacy)
    let productsSnapOldEmpty = true;
    if (subName) {
      const snap = await productsRef.where('subCategory', '==', subName).limit(1).get();
      productsSnapOldEmpty = snap.empty;
    }

    if (!productsSnap.empty || !productsSnapOldEmpty) {
      res.status(400).json({ error: 'Cannot delete subcategory because it has associated products. Please reassign or delete those products first.' });
      return;
    }

    await subcategoriesRef.doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete subcategory:', error);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/categories/sub/reorder
// Admin reorders subcategories
// ─────────────────────────────────────────────────────────
router.put('/sub/reorder', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: { id: string, order: number }[] };
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Expected array of items' });
      return;
    }

    const batch = db.batch();
    for (const item of items) {
      if (item.id && typeof item.order === 'number') {
        const ref = subcategoriesRef.doc(item.id);
        batch.update(ref, { order: item.order });
      }
    }

    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder subcategories:', error);
    res.status(500).json({ error: 'Failed to reorder subcategories' });
  }
});

export default router;
