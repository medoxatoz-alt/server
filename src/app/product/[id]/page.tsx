'use client';

import { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  Star, 
  ShieldCheck, 
  Truck, 
  BadgeCheck, 
  RotateCcw, 
  Plus, 
  Minus, 
  ShoppingBag,
  Award,
  Heart,
  Share2,
  MessageSquare
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';

const parseImages = (imageProp: any): string[] => {
  if (Array.isArray(imageProp)) return imageProp;
  if (typeof imageProp !== 'string') return ['https://via.placeholder.com/400?text=No+Image'];
  const trimmed = imageProp.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try { return JSON.parse(trimmed); } catch {}
  }
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((img) => img.trim());
  }
  return trimmed ? [trimmed] : ['https://via.placeholder.com/400?text=No+Image'];
};

export default function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'vendor' | 'reviews'>('desc');
  const [reviews, setReviews] = useState<any[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [userReview, setUserReview] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (user && id) {
      api.get('/user/wishlist')
        .then(res => {
          const ids = res.data.wishlistIds || [];
          setIsWishlisted(ids.includes(id));
        })
        .catch(err => console.error("Failed to fetch wishlist status", err));
    }
  }, [user, id]);

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please sign in to manage your wishlist');
      router.push('/signin');
      return;
    }
    setWishlistLoading(true);
    try {
      if (isWishlisted) {
        await api.delete(`/user/wishlist/${id}`);
        setIsWishlisted(false);
        toast.success('Removed from wishlist');
      } else {
        await api.post(`/user/wishlist/${id}`);
        setIsWishlisted(true);
        toast.success('Added to wishlist!');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  };

  const shareProduct = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.title || 'MedoxAtoZ Product',
          text: `Check out ${product?.title || 'this medical product'} on MedoxAtoZ!`,
          url: window.location.href,
        });
        toast.success('Shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to share.');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      } catch {
        toast.error('Failed to copy link.');
      }
    }
  };

  useEffect(() => {
    const fetchProductAndReviews = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
        if ((Number(res.data.stock) || 0) <= 0) {
          setQuantity(0);
        }
        
        const reviewsRes = await api.get(`/reviews/${id}`);
        setReviews(reviewsRes.data);

        // Check if user is logged in to get can-review status
        const token = document.cookie.includes('medox_token'); // crude check if there might be a session
        if (token || user) {
          try {
            const canReviewRes = await api.get(`/reviews/${id}/can-review`);
            setCanReview(canReviewRes.data.canReview);
            setHasReviewed(canReviewRes.data.hasReviewed || false);
            if (canReviewRes.data.existingReview) {
              setUserReview(canReviewRes.data.existingReview);
              setReviewRating(canReviewRes.data.existingReview.rating);
              setReviewComment(canReviewRes.data.existingReview.comment);
            }
          } catch(e) {}
        }
      } catch (err) {
        toast.error('Product not found');
      } finally {
        setLoading(false);
      }
    };
    fetchProductAndReviews();
  }, [id, user]);
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post(`/reviews/${id}`, {
        rating: reviewRating,
        comment: reviewComment
      });
      toast.success('Review submitted successfully!');
      
      const reviewsRes = await api.get(`/reviews/${id}`);
      setReviews(reviewsRes.data);
      
      setProduct((prev: any) => ({
        ...prev,
        reviewCount: reviewsRes.data.length,
        rating: reviewsRes.data.length > 0 ? (reviewsRes.data.reduce((acc: number, cur: any) => acc + cur.rating, 0) / reviewsRes.data.length).toFixed(1) : prev.rating
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast('Please sign in to add to cart');
      router.push('/signin');
      return;
    }
    setAddingToCart(true);
    try {
      // Fetch current cart items to check existing quantity
      const cartRes = await api.get('/cart');
      const existingItem = cartRes.data.find((item: any) => item.productId === product.id);
      const currentQty = existingItem ? existingItem.quantity : 0;
      
      const targetQty = currentQty + quantity;
      const stock = Number(product.stock) || 0;

      if (stock < targetQty) {
        toast.error(`Cannot add to cart. Only ${stock} units available in stock (you already have ${currentQty} in your cart).`);
        setAddingToCart(false);
        return;
      }
      
      if (currentQty === 0) {
        await api.post(`/cart/${product.id}`);
        if (targetQty > 1) {
          await api.patch(`/cart/${product.id}`, { quantity: targetQty });
        }
      } else {
        await api.patch(`/cart/${product.id}`, { quantity: targetQty });
      }

      toast.success('Added to Cart!');
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 py-20 animate-pulse">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
          <p className="mt-4 text-gray-500 font-semibold tracking-wide">Loading premium medical supplies...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 py-20">
          <ErrorState message="Product not found." />
        </div>
      </div>
    );
  }

  const images = parseImages(product.image);
  const activeImageUrl = images[activeImgIdx] || images[0] || 'https://via.placeholder.com/400';
  const price = typeof product.price === 'string' ? parseFloat(product.price.replace(/,/g, '')) : Number(product.price);
  const mrp = product.mrp ? (typeof product.mrp === 'string' ? parseFloat(product.mrp.replace(/,/g, '')) : Number(product.mrp)) : null;
  const discountPercentage = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const rating = product.rating || 4.8;
  const reviewCount = product.reviewCount || 0;

  return (
    <main className="bg-[var(--bg-page)] min-h-screen pb-20">
      <Navbar />
      
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Breadcrumb */}
        <div className="text-xs text-gray-500 mb-6 flex items-center gap-1.5 font-medium">
          <span className="hover:text-gold-primary cursor-pointer transition-colors" onClick={() => router.push('/')}>Home</span>
          <span>/</span>
          <span className="text-gray-400 capitalize">{product.category}</span>
          <span>/</span>
          <span className="text-gray-800 font-semibold truncate max-w-[200px] sm:max-w-xs">{product.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image Area (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-[var(--shadow-soft)] flex justify-center items-center overflow-hidden relative group h-[340px] sm:h-[450px]">
              {discountPercentage > 0 && (
                <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[11px] uppercase tracking-wider font-extrabold px-3 py-1 rounded shadow-md">
                  {discountPercentage}% OFF
                </div>
              )}
              
              <img 
                key={activeImageUrl}
                src={activeImageUrl} 
                alt={product.title} 
                className="max-w-full max-h-full object-contain transition-transform duration-500 hover:scale-105" 
              />
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2.5 mt-4 overflow-x-auto py-1 no-scrollbar max-w-full">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveImgIdx(idx);
                    }}
                    className={`w-[70px] h-[70px] rounded-lg border-2 p-1 bg-white flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 shrink-0 ${
                      idx === activeImgIdx 
                        ? 'border-gold-primary shadow-md scale-105' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={img} alt={`${product.title} view ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* Quality Seals */}
            <div className="mt-8 grid grid-cols-2 gap-3.5">
              <div className="bg-white p-3.5 rounded-xl border border-gray-200/50 flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-gold-primary rounded-lg">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">ISO 13485</div>
                  <div className="text-[10px] text-gray-500 font-medium">Certified Quality</div>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200/50 flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Secure Checkout</div>
                  <div className="text-[10px] text-gray-500 font-medium">SSL Encrypted</div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column: Details Area (lg:col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200/60 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-gold-primary bg-amber-50/50 px-2.5 py-1 rounded">
                  {product.category}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={toggleWishlist}
                    disabled={wishlistLoading}
                    className={`p-1.5 hover:bg-gray-50 active:scale-90 rounded-full transition-all duration-150 cursor-pointer disabled:opacity-50 ${
                      isWishlisted ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                    }`}
                    aria-label="Add to wishlist"
                  >
                    <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
                  </button>
                  <button 
                    onClick={shareProduct}
                    className="p-1.5 hover:bg-gray-50 hover:text-gold-primary text-gray-400 active:scale-90 rounded-full transition-all duration-150 cursor-pointer" 
                    aria-label="Share product"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2.5 leading-snug">
                {product.title}
              </h1>

              {/* Ratings */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex text-amber-500 gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? 'fill-current' : 'text-gray-200'}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-800">{rating}</span>
                <span className="text-gray-300">|</span>
                <span className="text-xs font-semibold text-gray-500 hover:text-gold-primary cursor-pointer transition-colors underline decoration-gray-300">
                  {reviewCount} Clinic Reviews
                </span>
              </div>

              {/* Pricing Section */}
              <div className="border-t border-b border-gray-100 py-4 mb-6">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-extrabold text-gray-900">
                    ₹{price.toLocaleString('en-IN')}
                  </span>
                  {mrp && mrp > price && (
                    <>
                      <span className="text-sm text-gray-400 line-through">
                        ₹{mrp.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded ml-1">
                        {discountPercentage}% Save
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5 font-medium">Inclusive of all duties and taxes</div>
              </div>

              {/* Mini Highlights */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2.5 text-sm">
                  <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-gray-650 font-medium">Original Manufacturer Warranty Included</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Truck className="w-4 h-4 text-gold-primary shrink-0" />
                  <span className="text-gray-650 font-medium">Free Express Shipping to medical institutes</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <RotateCcw className="w-4 h-4 text-[#007185] shrink-0" />
                  <span className="text-gray-650 font-medium">10 Days Easy Return Policy</span>
                </div>
              </div>
            </div>

            {/* Information Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[var(--shadow-soft)] overflow-hidden">
              <div className="flex border-b border-gray-100 bg-gray-50">
                <button
                  onClick={() => setActiveTab('desc')}
                  className={`flex-1 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 active:scale-95 cursor-pointer ${
                    activeTab === 'desc' 
                      ? 'border-gold-primary text-gold-primary bg-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Description
                </button>
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`flex-1 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 active:scale-95 cursor-pointer ${
                    activeTab === 'specs' 
                      ? 'border-gold-primary text-gold-primary bg-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveTab('vendor')}
                  className={`flex-1 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 active:scale-95 cursor-pointer ${
                    activeTab === 'vendor' 
                      ? 'border-gold-primary text-gold-primary bg-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Vendor
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`flex-1 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 active:scale-95 cursor-pointer ${
                    activeTab === 'reviews' 
                      ? 'border-gold-primary text-gold-primary bg-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Reviews ({reviews.length})
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'desc' && (
                  <p className="leading-relaxed text-gray-700 text-sm whitespace-pre-line">
                    {product.description || 'No detailed description provided for this premium medical equipment.'}
                  </p>
                )}

                {activeTab === 'specs' && (
                  <div className="overflow-hidden border border-gray-100 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-100 text-sm text-left">
                      <tbody className="divide-y divide-gray-100 bg-white">
                        <tr className="bg-gray-50/50">
                          <td className="px-4 py-2.5 font-bold text-gray-500 w-1/3">Item Category</td>
                          <td className="px-4 py-2.5 text-gray-800 font-medium capitalize">{product.category}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-bold text-gray-500">Status</td>
                          <td className="px-4 py-2.5 text-emerald-700 font-bold">
                            {product.stock && product.stock > 0 ? 'Certified In Stock' : 'Pre-order Available'}
                          </td>
                        </tr>
                        <tr className="bg-gray-50/50">
                          <td className="px-4 py-2.5 font-bold text-gray-500">Compliance</td>
                          <td className="px-4 py-2.5 text-gray-800 font-medium">CE / FDA Registered</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-bold text-gray-500">Target Segment</td>
                          <td className="px-4 py-2.5 text-gray-800 font-medium">Hospitals & Clinics</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'vendor' && (
                  <div className="flex flex-col gap-2.5">
                    <div className="text-sm font-bold text-gray-900">Medox Verified Partner</div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      This item is shipped directly from a certified medical warehousing facility to maintain precise temperature and moisture controls. Only authorized vendors can publish listing records.
                    </p>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="flex flex-col gap-6">
                    {/* Review Form */}
                    {canReview && (
                      <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">
                          {userReview ? 'Update Your Review' : 'Write a Review'}
                        </h3>
                        <form onSubmit={handleSubmitReview} className="flex flex-col gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rating</label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setReviewRating(star)}
                                  className="focus:outline-none cursor-pointer"
                                >
                                  <Star className={`w-6 h-6 ${star <= reviewRating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Review Comment (Optional)</label>
                            <textarea
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Share your experience with this medical equipment..."
                              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-gold-primary/50 focus:border-gold-primary outline-none min-h-[100px] resize-y"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={submittingReview}
                            className="self-start bg-gray-900 hover:bg-black text-white font-bold py-2 px-6 rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                          </button>
                        </form>
                      </div>
                    )}

                    {!canReview && user && !hasReviewed && (
                      <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100 text-sm text-amber-800 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        You must purchase this product to leave a verified review.
                      </div>
                    )}

                    {hasReviewed && (
                      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-sm text-emerald-800 flex items-center gap-2">
                        <BadgeCheck className="w-4 h-4" />
                        You have already reviewed this product. Thank you!
                      </div>
                    )}

                    {/* Review List */}
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-gray-900">Customer Reviews</h3>
                      {reviews.length === 0 ? (
                        <EmptyState message="No reviews yet. Be the first to review after purchase!" />
                      ) : (
                        reviews.map((review) => (
                          <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-bold text-gray-900 text-sm">{review.userName}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                            <div className="flex text-amber-500 gap-0.5 mb-2">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                              ))}
                            </div>
                            {review.comment && (
                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{review.comment}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Action Widget (lg:col-span-3) */}
          <div className="lg:col-span-3 w-full sticky top-24">
            <div className="bg-white p-6 rounded-2xl border-t-4 border-t-gold-primary border-x border-b border-gray-200/80 shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
              <div className="text-3xl font-extrabold text-gray-900 mb-1">
                ₹{price.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-gray-400 mb-5 font-semibold">FREE Delivery to your clinic address</div>
              
              <div className="flex flex-col gap-1 mb-5">
                <div className="text-emerald-600 font-bold text-sm">In Stock & Secure</div>
                <div className="text-xs text-gray-500 font-medium">Estimated Dispatch: Within 24 Hours</div>
              </div>

              {/* Quantity Selector */}
              {(() => {
                const stock = Number(product.stock) || 0;
                const isOutOfStock = stock <= 0;
                return (
                  <>
                    <div className="mb-6 flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-xs font-extrabold text-gray-650 pl-1.5">Quantity</span>
                      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-1">
                        <button
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={isOutOfStock || quantity <= 1}
                          className="p-1 hover:bg-gray-50 active:scale-90 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-all duration-150 cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-2" />
                        </button>
                        <span className="text-sm font-extrabold text-gray-800 w-4 text-center">{quantity}</span>
                        <button
                          onClick={() => setQuantity(q => Math.min(Math.min(10, stock), q + 1))}
                          disabled={isOutOfStock || quantity >= Math.min(10, stock)}
                          className="p-1 hover:bg-gray-50 active:scale-90 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-all duration-150 cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-2" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleAddToCart}
                        disabled={isOutOfStock || addingToCart}
                        className={`w-full py-3.5 font-extrabold rounded-full transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                          isOutOfStock 
                            ? 'bg-gray-200 text-gray-400 border border-gray-200 shadow-none cursor-not-allowed' 
                            : 'bg-gold-primary hover:bg-gold-hover text-[#2b3036] shadow-amber-500/10 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 stroke-2" />
                        <span>{isOutOfStock ? 'Out of Stock' : addingToCart ? 'Adding to Cart...' : 'Add to Cart'}</span>
                      </button>
                    </div>
                  </>
                );
              })()}

              <div className="mt-6 border-t border-gray-100 pt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified Purchase Guard</span>
                </div>
                <div className="text-[10px] text-gray-500 leading-normal">
                  All equipment meets central medical device certification guidelines. 100% money back guarantee.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
