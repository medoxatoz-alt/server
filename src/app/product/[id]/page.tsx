'use client';

import { useEffect, useState, use, useRef } from 'react';
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
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import React from 'react';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showThumbArrows, setShowThumbArrows] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [navHeight, setNavHeight] = useState(112); // fallback desktop height

  useEffect(() => {
    const updateHeight = () => {
      const header = document.querySelector('header');
      if (header) {
        setNavHeight(header.getBoundingClientRect().height);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    const header = document.querySelector('header');
    let observer: ResizeObserver | null = null;
    if (header && window.ResizeObserver) {
      observer = new ResizeObserver(updateHeight);
      observer.observe(header);
    }
    
    return () => {
      window.removeEventListener('resize', updateHeight);
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const checkOverflow = () => {
      if (scrollRef.current) {
        setShowThumbArrows(scrollRef.current.scrollWidth > scrollRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [product]);

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
      } catch (err: any) {
        const msg = err.response?.data?.error || 'Product not found';
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchProductAndReviews();
  }, [id, user]);

  const handleAddToCart = async () => {
    if (!user) {
      toast('Please sign in to add to cart');
      router.push('/signin');
      return;
    }
    setAddingToCart(true);
    try {
      const cartRes = await api.get('/cart');
      const existingItem = cartRes.data.find((item: any) => item.productId === product.id);
      const currentQty = existingItem ? existingItem.quantity : 0;
      
      const targetQty = currentQty + quantity;
      const stock = Number(product.stock) || 0;

      if (stock < targetQty) {
        toast.error(`Cannot add to cart. Only ${stock} units available in stock (you already have ${currentQty} in your cart).`);
        setAddingToCart(false);
        return false;
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
      return true;
    } catch (err) {
      toast.error('Failed to add to cart');
      return false;
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast('Please sign in to buy');
      router.push('/signin');
      return;
    }
    
    window.dispatchEvent(new CustomEvent('open-checkout', { 
      detail: { 
        buyNowItem: { 
          productId: product.id, 
          quantity: quantity 
        } 
      } 
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="max-w-[1500px] w-full mx-auto lg:px-8 py-0 lg:py-12 lg:pt-5 animate-pulse mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-10 items-start px-4 lg:px-0">
            {/* Left: Image Skeleton */}
            <div className="lg:col-span-7 w-full flex flex-col gap-4">
              <div className="w-full aspect-square lg:aspect-[4/3] bg-gray-200 rounded-2xl"></div>
              <div className="hidden lg:flex gap-3">
                {[1,2,3,4].map(i => <div key={i} className="w-24 h-24 bg-gray-200 rounded-xl shrink-0"></div>)}
              </div>
            </div>
            {/* Right: Details Skeleton */}
            <div className="lg:col-span-5 flex flex-col gap-6 mt-6 lg:mt-0 w-full">
              <div className="w-20 h-6 bg-gray-200 rounded-md"></div>
              <div className="w-3/4 h-10 bg-gray-200 rounded-lg"></div>
              <div className="w-1/3 h-10 bg-gray-200 rounded-lg mt-2"></div>
              
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="h-16 bg-gray-200 rounded-xl"></div>
                <div className="h-16 bg-gray-200 rounded-xl"></div>
              </div>

              <div className="h-24 bg-gray-200 rounded-2xl mt-4"></div>
              <div className="h-40 bg-gray-200 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 py-20">
          <ErrorState message={errorMsg} />
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

  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : parseImages(product.image);
  const activeImageUrl = images[activeImgIdx] || images[0] || 'https://via.placeholder.com/400';
  const price = typeof product.price === 'string' ? parseFloat(product.price.replace(/,/g, '')) : Number(product.price);
  const mrp = product.mrp ? (typeof product.mrp === 'string' ? parseFloat(product.mrp.replace(/,/g, '')) : Number(product.mrp)) : null;
  const discountPercentage = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;


  return (
    <main className="bg-white lg:bg-[var(--bg-page)] min-h-screen pb-28 lg:pb-20">
      <Navbar />
      
      {/* Sticky Back Button Bar - Merges with Navbar */}
      <div
        className="sticky z-[990] bg-[#0d1117] border-b border-white/10 px-3.5 md:px-5 py-2 md:py-2.5 shadow-sm -mt-[2px]"
        style={{ top: `${navHeight - 1}px` }}
      >
        <div className="max-w-[1500px] mx-auto lg:px-4 flex items-center">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-1 md:gap-1.5 text-[13px] md:text-sm font-semibold text-white/80 hover:text-white transition-colors cursor-pointer w-fit group border-none bg-transparent outline-none p-0"
          >
            <ChevronLeft className="w-4 h-4 md:w-4 md:h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="tracking-wide">Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto lg:px-8 py-0 lg:py-12 lg:pt-5">
        
   
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-10 items-start">
          
          {/* Left Column: Image Gallery (lg:col-span-7) */}
          <div className="lg:col-span-7 w-full">
            {/* Mobile View: Horizontal Snap Scroll */}
            <div className="lg:hidden relative">
              <div 
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-gray-50 border-b border-gray-200"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  const newIndex = Math.round(target.scrollLeft / target.clientWidth);
                  setActiveImgIdx(newIndex);
                }}
              >
                {images.map((img: string, idx: number) => (
                  <div key={idx} className="w-full shrink-0 snap-center aspect-square flex items-center justify-center relative">
                    <img src={img} alt={`${product.title} ${idx + 1}`} className="w-full h-full object-contain p-6" />
                  </div>
                ))}
              </div>

              {/* Stationary Discount Badge */}
              {discountPercentage > 0 && (
                <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[11px] uppercase tracking-wider font-extrabold px-3 py-1 rounded shadow-md pointer-events-none">
                  {discountPercentage}% OFF
                </div>
              )}
              
              {/* Stationary Indicators */}
              {images.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                  {images.map((_: any, dotIdx: number) => (
                    <div key={dotIdx} className={`h-1.5 rounded-full transition-all duration-300 ${activeImgIdx === dotIdx ? 'w-4 bg-gray-800' : 'w-1.5 bg-gray-300'}`} />
                  ))}
                </div>
              )}
            </div>

            {/* Desktop View: Single Main Image + Thumbnails */}
            <div className="hidden lg:flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm flex items-center justify-center relative aspect-[4/3] overflow-hidden group">
                {discountPercentage > 0 && (
                  <div className="absolute top-6 left-6 z-10 bg-red-600 text-white text-xs uppercase tracking-wider font-extrabold px-3 py-1.5 rounded shadow-md">
                    {discountPercentage}% OFF
                  </div>
                )}
                
                {images.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveImgIdx(prev => prev === 0 ? images.length - 1 : prev - 1);
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md p-2 rounded-full border border-gray-200 text-gray-700 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveImgIdx(prev => prev === images.length - 1 ? 0 : prev + 1);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md p-2 rounded-full border border-gray-200 text-gray-700 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10">
                      {images.map((_: any, dotIdx: number) => (
                        <div key={dotIdx} className={`h-1.5 rounded-full transition-all duration-300 ${activeImgIdx === dotIdx ? 'w-4 bg-gray-800' : 'w-2 bg-gray-300'}`} />
                      ))}
                    </div>
                  </>
                )}

                <img 
                  src={images[activeImgIdx] || images[0] || 'https://via.placeholder.com/400'} 
                  alt={product.title} 
                  className="w-full h-full object-contain p-10 transition-transform duration-500 group-hover:scale-105" 
                />
              </div>

              {images.length > 1 && (
                <div className="relative group">
                  {showThumbArrows && (
                    <button 
                      onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md p-1.5 rounded-full border border-gray-200 text-gray-700 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div ref={scrollRef} className="flex gap-3 overflow-x-auto py-1 no-scrollbar scroll-smooth">
                    {images.map((img: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImgIdx(idx)}
                        className={`w-24 h-24 rounded-xl border-2 p-2 bg-white flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                          idx === activeImgIdx 
                            ? 'border-gray-900 shadow-md scale-[1.02]' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img src={img} alt={`${product.title} view ${idx + 1}`} className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                  {showThumbArrows && (
                    <button 
                      onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md p-1.5 rounded-full border border-gray-200 text-gray-700 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Details & Actions (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-8 lg:sticky lg:top-24 px-4 sm:px-6 lg:px-0 py-6 lg:py-0">
            
            {/* Title & Header */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-gold-primary bg-amber-50 px-2.5 py-1 rounded">
                  {product.category}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={toggleWishlist}
                    disabled={wishlistLoading}
                    className={`p-2 bg-gray-50 hover:bg-gray-100 active:scale-90 rounded-full transition-all duration-150 cursor-pointer disabled:opacity-50 ${
                      isWishlisted ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                    }`}
                    aria-label="Add to wishlist"
                  >
                    <Heart className="w-5 h-5" fill={isWishlisted ? 'currentColor' : 'none'} />
                  </button>
                  <button 
                    onClick={shareProduct}
                    className="p-2 bg-gray-50 hover:bg-gray-100 hover:text-gold-primary text-gray-400 active:scale-90 rounded-full transition-all duration-150 cursor-pointer" 
                    aria-label="Share product"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-tight">
                {product.title}
              </h1>

              {/* Price */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                  ₹{price.toLocaleString('en-IN')}
                </span>
                {mrp && mrp > price && (
                  <>
                    <span className="text-base text-gray-400 line-through ml-1">
                      ₹{mrp.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded ml-2">
                      {discountPercentage}% Save
                    </span>
                  </>
                )}
              </div>
              <div className="text-[12px] text-gray-500 mt-1 font-medium">Inclusive of all duties and taxes</div>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                <div className="text-gold-primary">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">ISO 13485</div>
                  <div className="text-[10px] text-gray-500 font-medium">Certified Quality</div>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                <div className="text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Secure Checkout</div>
                  <div className="text-[10px] text-gray-500 font-medium">SSL Encrypted</div>
                </div>
              </div>
            </div>

            {/* Inline Checkout Actions (All Devices) */}
            {(() => {
              const stock = Number(product.stock) || 0;
              const isOutOfStock = stock <= 0;
              return (
                <div className="flex flex-col gap-5 border-y border-gray-100 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className={isOutOfStock ? "text-red-600 font-bold text-sm" : "text-emerald-600 font-bold text-sm"}>
                        {isOutOfStock ? "Out of Stock" : "In Stock & Ready to Ship"}
                      </div>
                      {!isOutOfStock && <div className="text-xs text-gray-500 font-medium flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Dispatches within 24 Hrs</div>}
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-1">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={isOutOfStock || quantity <= 1}
                        className="p-2 hover:bg-white active:scale-90 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-all duration-150 cursor-pointer"
                      >
                        <Minus className="w-4 h-4 stroke-2" />
                      </button>
                      <span className="text-sm font-extrabold text-gray-800 w-6 text-center">{quantity}</span>
                      <button
                        onClick={() => setQuantity(q => Math.min(Math.min(10, stock), q + 1))}
                        disabled={isOutOfStock || quantity >= Math.min(10, stock)}
                        className="p-2 hover:bg-white active:scale-90 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-all duration-150 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-2" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Action Buttons */}
                  <div className="flex gap-3">
                    <button 
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || addingToCart}
                      className={`flex-1 py-4 font-extrabold rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                        isOutOfStock 
                          ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' 
                          : 'bg-white text-gray-900 border-2 border-gray-900 hover:bg-gray-50 active:scale-95 disabled:opacity-50'
                      }`}
                    >
                      {addingToCart ? <Loader2 className="w-4 h-4 stroke-2 animate-spin" /> : <ShoppingBag className="w-4 h-4 stroke-2" />}
                      <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
                    </button>
                    
                    <button 
                      onClick={handleBuyNow}
                      disabled={isOutOfStock || addingToCart}
                      className={`flex-1 py-4 font-extrabold rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center ${
                        isOutOfStock 
                          ? 'hidden' 
                          : 'bg-gold-primary hover:bg-gold-hover text-[#2b3036] active:scale-95 disabled:opacity-50'
                      }`}
                    >
                      <span>Buy Now</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Description & Specs */}
            <div className="flex flex-col gap-6">
              
              {/* Product Specifications */}
              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                <h2 className="text-sm font-extrabold text-gray-900 mb-4 uppercase tracking-wider">Specifications</h2>
                <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-y-3 text-sm">
                  <div className="font-bold text-gray-800">Category</div>
                  <div className="text-gray-600 capitalize">{product.category}</div>
                  
                  <div className="font-bold text-gray-800">Availability</div>
                  <div className="text-emerald-700 font-semibold">{product.stock && product.stock > 0 ? 'In Stock' : 'Out of Stock'}</div>

                  {product.attributes && product.attributes.map((attr: any, idx: number) => (
                    <React.Fragment key={idx}>
                      <div className="font-bold text-gray-800 capitalize">{attr.key}</div>
                      <div className="text-gray-600">{attr.value}</div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* About this item */}
              <div className="bg-white lg:bg-transparent rounded-2xl lg:p-0">
                <h2 className="text-sm font-extrabold text-gray-900 mb-3 uppercase tracking-wider">About this item</h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.description ? (
                    <ul className="list-disc pl-5 space-y-2.5 marker:text-gray-300">
                      {product.description.split('\n').map((line: string, i: number) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        return <li key={i} className="pl-1">{trimmed.replace(/^- /, '')}</li>;
                      })}
                    </ul>
                  ) : (
                    <p className="italic text-gray-400">No detailed description provided.</p>
                  )}
                </div>
              </div>

              {/* Vendor Information */}
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mt-2">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="w-5 h-5 text-gold-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-gray-900 mb-1">
                      {product.is_sold_by_vendor ? 'Verified Independent Vendor' : 'Medox Certified Origin'}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {product.is_sold_by_vendor 
                        ? 'Sold by a vetted third-party vendor. Protected by MedoxAtoZ guarantee.'
                        : 'Shipped from a certified medical warehousing facility with climate control.'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
