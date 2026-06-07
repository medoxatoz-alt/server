'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Trash2, ShieldCheck, Truck } from 'lucide-react';

import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// --- Types ---
interface CartItem {
  productId: string;
  quantity: number;
}

interface Product {
  _id?: string;
  title: string;
  price: string | number;
  image: string | string[];
}

export default function Cart() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // --- Auth Check ---
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
      toast('Please sign in to view your cart', { icon: '🛒' });
    }
  }, [user, authLoading, router]);

  // --- Data Fetching ---
  const fetchCartAndProducts = async () => {
    try {
      const { data: items } = await api.get('/cart');
      setCartItems(items);

      // Fetch all missing product details in PARALLEL
      const missingProductIds = items
        .map((item: CartItem) => item.productId)
        .filter((id: string) => !productDetails[id]);

      if (missingProductIds.length > 0) {
        const productPromises = missingProductIds.map((id: string) => api.get(`/products/${id}`));
        const productResponses = await Promise.all(productPromises);

        const newDetails = { ...productDetails };
        productResponses.forEach((res, index) => {
          newDetails[missingProductIds[index]] = res.data;
        });
        setProductDetails(newDetails);
      }
    } catch (err) {
      console.error('Failed to fetch cart', err);
      toast.error('Could not load your cart.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchCartAndProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- Handlers ---
  const handleUpdateQty = async (productId: string, newQty: number) => {
    const p = productDetails[productId];
    const stock = p ? (Number((p as any).stock) || 0) : 0;
    if (p && newQty > stock) {
      toast.error(`Only ${stock} units available in stock.`);
      return;
    }
    setIsUpdating(productId);
    try {
      if (newQty <= 0) {
        await api.delete(`/cart/${productId}`);
        toast.success('Item removed');
      } else {
        await api.patch(`/cart/${productId}`, { quantity: newQty });
      }
      await fetchCartAndProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update quantity');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemove = async (productId: string) => {
    setIsUpdating(productId);
    try {
      await api.delete(`/cart/${productId}`);
      toast.success('Item removed from cart');
      await fetchCartAndProducts();
    } catch (err) {
      toast.error('Failed to remove item');
    } finally {
      setIsUpdating(null);
    }
  };

  // --- Helpers ---
  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      const p = productDetails[item.productId];
      if (!p) return total;

      const price = typeof p.price === 'string'
        ? parseFloat(p.price.replace(/,/g, ''))
        : Number(p.price);

      return total + (price * item.quantity);
    }, 0);
  };

  // --- Render States ---
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
          <p className="mt-4 text-gray-500 font-semibold tracking-wide">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const totalAmount = calculateTotal();
  const hasInventoryIssues = cartItems.some(item => {
    const p = productDetails[item.productId];
    if (!p) return false;
    const stock = Number((p as any).stock) || 0;
    return stock < item.quantity;
  });

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-24">
      <Navbar />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight flex items-center gap-3">
          <span className="w-1.5 h-8 bg-gold-primary rounded-full"></span>
          Shopping Cart
        </h1>

        {cartItems.length === 0 ? (
          <div className="bg-white mt-5 rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-full max-w-[480px] mb-8 transform hover:scale-[1.02] transition-transform duration-500 ease-out">
              <DotLottieReact
                src="https://lottie.host/c79bec0a-7f01-4537-bf9b-69f8ef77b8f3/8hIlnWm3PQ.lottie"
                loop
                autoplay
              />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Your cart is empty</h2>
            <p className="text-gray-500 mb-8 max-w-md text-base leading-relaxed">
              Looks like you haven't added any items yet. Explore our premium selection and find what you need.
            </p>
            <Link
              href="/"
              className="px-10 py-4 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-full transition-all duration-300 shadow-md hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 max-w-xs mx-auto cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Continue Shopping</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* Cart Items List */}
            <div className="flex-1 w-full bg-white rounded-2xl shadow-[var(--shadow-soft)] border-t-4 border-t-gold-primary border-x border-b border-gray-100/80 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                {cartItems.map((item) => {
                  const p = productDetails[item.productId];
                  if (!p) return null;

                  const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price);
                  const img = Array.isArray(p.image) ? p.image[0] : (p.image || 'https://via.placeholder.com/150');
                  const isItemUpdating = isUpdating === item.productId;

                  return (
                    <div
                      key={item.productId}
                      className={`flex flex-col sm:flex-row gap-6 pb-6 border-b border-gray-100 last:border-0 last:pb-0 transition-all duration-300 ${isItemUpdating ? 'opacity-50 pointer-events-none' : 'opacity-100'
                        } hover:bg-gray-50/50 p-4 -mx-4 rounded-xl group`}
                    >
                      {/* Product Image */}
                      <Link href={`/product/${item.productId}`} className="shrink-0 block bg-white rounded-xl p-3 border border-gray-100 hover:border-gray-300 transition-colors shadow-sm overflow-hidden relative">
                        <img
                          src={img}
                          alt={p.title}
                          className="w-28 h-28 sm:w-32 sm:h-32 object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>

                      {/* Product Details & Actions */}
                      <div className="flex flex-col flex-1">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
                          <div>
                            <Link href={`/product/${item.productId}`}>
                              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 hover:text-gold-primary transition-colors duration-200">
                                {p.title}
                              </h3>
                            </Link>
                            {(() => {
                              const stock = Number((p as any).stock) || 0;
                              if (stock <= 0) {
                                return <p className="text-sm text-red-600 font-bold mt-1">Out of Stock</p>;
                              } else if (stock <= 5) {
                                return <p className="text-sm text-amber-600 font-bold mt-1">Only {stock} left in stock!</p>;
                              } else {
                                return <p className="text-sm text-emerald-600 font-medium mt-1">In Stock</p>;
                              }
                            })()}
                          </div>
                          <p className="text-xl font-bold text-gray-900 shrink-0">
                            ₹{price.toLocaleString('en-IN')}
                          </p>
                        </div>

                        {/* Quantity & Delete Controls */}
                        <div className="mt-auto flex items-center justify-between">
                          <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                             <button
                              onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:scale-90 transition-all duration-150 cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-12 text-center font-bold text-gray-800 text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                              disabled={item.quantity >= (Number((p as any).stock) || 0)}
                              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <button
                            onClick={() => handleRemove(item.productId)}
                            className="flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-100 transition-all active:scale-90 duration-150 cursor-pointer"
                          >
                            <Trash2 size={16} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Summary Sidebar */}
            <div className="w-full lg:w-[380px] shrink-0">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-[var(--shadow-soft)] border-t-4 border-t-gold-primary border-x border-b border-gray-100/80 sticky top-24">
                <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-100">Order Summary</h2>

                <div className="space-y-4 mb-6 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({cartItems.length} items)</span>
                    <span className="font-semibold text-gray-800">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Estimated Delivery</span>
                    <span className="text-emerald-600 font-semibold">Free</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mb-8">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-base font-semibold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs text-gray-500 text-right">Inclusive of all taxes</p>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  disabled={hasInventoryIssues}
                  className={`w-full py-4 font-bold rounded-lg transition-all duration-200 shadow-md mb-6 cursor-pointer flex items-center justify-center gap-2 ${hasInventoryIssues
                      ? 'bg-gray-200 text-gray-400 border border-gray-300 shadow-none cursor-not-allowed'
                      : 'bg-gold-primary hover:bg-gold-hover text-text-main shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.97]'
                    }`}
                >
                  Proceed to Checkout
                </button>
                {hasInventoryIssues && (
                  <p className="text-[11px] text-red-600 font-semibold text-center mb-4 leading-normal">
                    Some items in your cart exceed available stock. Please reduce their quantities or remove them to checkout.
                  </p>
                )}

                {/* Trust Badges */}
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Secure checkout process</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Truck className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Free shipping on this order</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}