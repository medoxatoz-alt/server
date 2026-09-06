'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Trash2, X, ShoppingBag } from 'lucide-react';

import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CheckoutModal from '@/components/CheckoutModal';

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

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState<{ productId: string, quantity: number } | null>(null);

  // Close drawer if pressed escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleOpenCheckout = (e: any) => {
      if (e.detail?.buyNowItem) {
        setBuyNowItem(e.detail.buyNowItem);
      } else {
        setBuyNowItem(null);
      }
      setIsCheckoutOpen(true);
    };
    window.addEventListener('open-checkout', handleOpenCheckout);
    return () => window.removeEventListener('open-checkout', handleOpenCheckout);
  }, []);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const fetchCartAndProducts = async () => {
    setLoading(true);
    try {
      const { data: items } = await api.get('/cart');
      setCartItems(items);

      const missingProductIds = items
        .map((item: CartItem) => item.productId)
        .filter((id: string) => !productDetails[id]);

      if (missingProductIds.length > 0) {
        const productPromises = missingProductIds.map((id: string) => 
          api.get(`/products/${id}`).catch(async err => {
            console.error(`Failed to fetch product ${id}`, err);
            try {
              await api.delete(`/cart/${id}`);
              setCartItems(prev => prev.filter(i => i.productId !== id));
            } catch (delErr) {
              console.error(`Failed to auto-remove unavailable product ${id}`, delErr);
            }
            return null;
          })
        );
        const productResponses = await Promise.all(productPromises);

        const newDetails = { ...productDetails };
        productResponses.forEach((res, index) => {
          if (res && res.data) {
            newDetails[missingProductIds[index]] = res.data;
          }
        });
        setProductDetails(newDetails);
      }
    } catch (err) {
      console.error('Failed to fetch cart', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchCartAndProducts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

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
      
      // Update local state optimistic
      setCartItems(prev => {
        if (newQty <= 0) return prev.filter(i => i.productId !== productId);
        return prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i);
      });
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update quantity');
      await fetchCartAndProducts();
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemove = async (productId: string) => {
    setIsRemoving(productId);
    setIsUpdating(productId);
    try {
      await api.delete(`/cart/${productId}`);
      toast.success('Item removed');
      setCartItems(prev => prev.filter(i => i.productId !== productId));
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      toast.error('Failed to remove item');
      await fetchCartAndProducts();
    } finally {
      setIsRemoving(null);
      setIsUpdating(null);
    }
  };

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

  if (!isOpen) {
    return (
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} buyNowItem={buyNowItem} />
    );
  }

  const totalAmount = calculateTotal();
  const hasInventoryIssues = cartItems.some(item => {
    const p = productDetails[item.productId];
    if (!p) return false;
    const stock = Number((p as any).stock) || 0;
    return stock < item.quantity;
  });

  return (
    <div className="fixed inset-0 z-[2000] flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute pt-4 right-0 top-0 bottom-0 w-full sm:w-[450px] max-w-[100vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="text-[#0d1117]  px-5 py-4 flex items-center justify-between shrink-0  ">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="w-6 h-6 text-[#0d1117] stroke-2" />
              <span className="bg-gold-primary  text-[#0d1117] font-extrabold text-[10px] h-[16px] min-w-[16px] rounded-full inline-flex items-center justify-center px-1 border-2 border-[#0d1117] absolute -top-1.5 -right-1.5 z-[2]">
                {cartItems.length}
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Your Cart</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-300 hover:text-[#0d1117]  text-[#0d1117]/10 rounded-full transition-colors cursor-pointer outline-none border-none bg-transparent"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-gray-50/50">
          {!user ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Sign in to view cart</h3>
              <p className="text-gray-500 mb-6 text-sm">You need to be logged in to manage your shopping cart.</p>
              <button 
                onClick={() => { onClose(); router.push('/signin'); }}
                className="px-8 py-3 bg-gold-primary text-text-main font-bold rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-none"
              >
                Sign In
              </button>
            </div>
          ) : authLoading || loading ? (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-gold-primary animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-500">Loading cart...</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-48 h-48 mb-4">
                <DotLottieReact
                  src="https://lottie.host/c79bec0a-7f01-4537-bf9b-69f8ef77b8f3/8hIlnWm3PQ.lottie"
                  loop
                  autoplay
                />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-sm text-gray-500 mb-6">Explore our premium selection to find what you need.</p>
              <button 
                onClick={onClose}
                className="px-6 py-2.5 border-2 border-gold-primary text-gold-700 hover:bg-gold-primary hover:text-text-main font-bold rounded-full transition-all cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cartItems.map((item) => {
                const p = productDetails[item.productId];
                if (!p) return null;

                const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price);
                const img = Array.isArray(p.image) ? p.image[0] : (p.image || 'https://via.placeholder.com/150');
                const isItemUpdating = isUpdating === item.productId;
                const isItemRemoving = isRemoving === item.productId;

                return (
                  <div
                    key={item.productId}
                    className={`bg-white border border-gray-100 p-3 rounded-xl shadow-sm flex gap-4 transition-opacity ${isItemUpdating ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
                  >
                    <Link href={`/product/${item.productId}`} onClick={onClose} className="shrink-0 w-20 h-20 bg-gray-50 rounded-lg p-1.5 flex items-center justify-center cursor-pointer">
                      <img src={img} alt={p.title} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                    </Link>
                    
                    <div className="flex flex-col flex-1">
                      <Link href={`/product/${item.productId}`} onClick={onClose} className="text-sm font-bold text-gray-900 line-clamp-2 hover:text-gold-primary transition-colors mb-1">
                        {p.title}
                      </Link>
                      
                      <div className="text-gold-600 font-bold text-sm mb-2">
                        ₹{price.toLocaleString('en-IN')}
                      </div>
                      
                      <div className="mt-auto flex items-center justify-between">
                        {/* Quantity */}
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                            className="px-2 py-1.5 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer border-none bg-transparent"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-gray-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= (Number((p as any).stock) || 0)}
                            className="px-2 py-1.5 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer border-none bg-transparent"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemove(item.productId)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer border-none bg-transparent"
                          aria-label="Remove item"
                        >
                          {isItemRemoving ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {user && cartItems.length > 0 && !loading && (
          <div className="bg-white border-t border-gray-100 p-5 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)] z-10">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="text-xl font-extrabold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            
            {hasInventoryIssues && (
              <p className="text-[11px] text-red-600 font-semibold mb-3">
                Some items exceed available stock. Please reduce quantities.
              </p>
            )}

            <button
              onClick={() => setIsCheckoutOpen(true)}
              disabled={hasInventoryIssues}
              className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border-none ${
                hasInventoryIssues
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gold-primary hover:bg-gold-hover text-text-main shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer'
              }`}
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>

      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} buyNowItem={buyNowItem} />
    </div>
  );
}
