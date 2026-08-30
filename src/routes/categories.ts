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
  { id: 'health-wellness', name: 'Health & Wellness Products' },
  { id: 'medical-products', name: 'Medical Products' },
  { id: 'surgical-products', name: 'Surgical Products' },
  { id: 'diagnostic-products', name: 'Diagnostic Products' },
  { id: 'home-lifestyle', name: 'Home & Lifestyle' },
  { id: 'puja-items', name: 'Puja Items' }
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
      if (data.mainCategoryId && subcategories[data.mainCategoryId] !== undefined) {
        subcategories[data.mainCategoryId].push({ id: doc.id, name: data.name });
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
      createdAt: new Date().toISOString()
    });
    
    res.status(201).json({ success: true, id: docRef.id, mainCategoryId, name: name.trim() });
  } catch (error) {
    console.error('Failed to create subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/categories/sub/:id
// Admin deletes a subcategory document
// ─────────────────────────────────────────────────────────
router.delete('/sub/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const { db } = require('../firebase');
    const productsRef = db.collection('products');
    const productsSnap = await productsRef.where('subCategoryId', '==', id).limit(1).get();
    const productsSnapOld = await productsRef.where('subCategory', '==', id).limit(1).get();

    if (!productsSnap.empty || !productsSnapOld.empty) {
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

export default router;
