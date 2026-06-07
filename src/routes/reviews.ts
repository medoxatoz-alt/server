// src/routes/reviews.ts

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';

const router = Router();

// GET /api/reviews/:productId
router.get('/:productId', async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('reviews').where('productId', '==', req.params.productId).get();
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by createdAt descending
    reviews.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(reviews);
  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// GET /api/reviews/:productId/can-review
router.get('/:productId/can-review', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const productId = req.params.productId;

    // Check if user has ordered the product
    const ordersSnap = await db.collection('orders').where('customerId', '==', userId).get();
    
    let hasPurchased = false;
    for (const d of ordersSnap.docs) {
      const order = d.data();
      if (order.items && order.items.some((item: any) => item.productId === productId)) {
        hasPurchased = true;
        break;
      }
    }

    if (!hasPurchased) {
      return res.json({ canReview: false });
    }

    // Check if user already reviewed
    const reviewSnap = await db.collection('reviews')
      .where('productId', '==', productId)
      .where('userId', '==', userId)
      .get();
    
    if (!reviewSnap.empty) {
      return res.json({ 
        canReview: false, 
        hasReviewed: true,
        existingReview: { id: reviewSnap.docs[0].id, ...reviewSnap.docs[0].data() } 
      });
    }

    res.json({ canReview: true, hasReviewed: false });
  } catch (error) {
    console.error('Check review eligibility error:', error);
    res.status(500).json({ error: 'Failed to check review eligibility.' });
  }
});

// POST /api/reviews/:productId
router.post('/:productId', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const userName = req.user!.name || req.user!.email || 'Anonymous';
    const productId = String(req.params.productId);
    const { rating, comment } = req.body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating. Must be between 1 and 5.' });
    }

    // 1. Verify purchase
    const ordersSnap = await db.collection('orders').where('customerId', '==', userId).get();
    
    let hasPurchased = false;
    for (const d of ordersSnap.docs) {
      const order = d.data();
      if (order.items && order.items.some((item: any) => item.productId === productId)) {
        hasPurchased = true;
        break;
      }
    }

    if (!hasPurchased) {
      return res.status(403).json({ error: 'You must purchase this product to review it.' });
    }

    // 2. Add or Update Review
    const reviewSnap = await db.collection('reviews')
      .where('productId', '==', productId)
      .where('userId', '==', userId)
      .get();

    if (!reviewSnap.empty) {
      return res.status(403).json({ error: 'You have already reviewed this product.' });
    }
    
    const reviewData = {
      productId,
      userId,
      userName,
      rating: Number(rating),
      comment: comment || '',
      createdAt: new Date().toISOString()
    };

    await db.collection('reviews').add(reviewData);

    // 3. Recalculate average rating for product
    const allReviewsSnap = await db.collection('reviews').where('productId', '==', productId).get();
    
    let totalRating = 0;
    const reviewCount = allReviewsSnap.size;
    
    allReviewsSnap.forEach(d => {
      totalRating += d.data().rating;
    });

    const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;

    // 4. Update Product
    const productRef = db.collection('products').doc(productId);
    await productRef.update({
      rating: Number(averageRating),
      reviewCount
    });

    res.json({ success: true, message: 'Review submitted successfully.' });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

export default router;
