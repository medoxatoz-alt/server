'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Heart, Trash2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/signin');
  }, [user, authLoading, router]);

  const fetchWishlist = async () => {
    if (!user) return;
    setFetchError(false);
    try {
      const res = await api.get('/user/wishlist');
      const ids: string[] = res.data.wishlistIds || [];
      setWishlistIds(ids);

      if (ids.length > 0) {
        const productRes = await api.post('/products/bulk', { ids });
        // Preserve wishlist order
        const productMap = new Map(productRes.data.map((p: any) => [p.id, p]));
        setProducts(ids.map(id => productMap.get(id)).filter(Boolean) as any[]);
      } else {
        setProducts([]);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWishlist(); }, [user]);

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    try {
      await api.delete(`/user/wishlist/${productId}`);
      toast.success('Removed from wishlist');
      setWishlistIds(prev => prev.filter(id => id !== productId));
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch {
      toast.error('Failed to remove from wishlist');
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddToCart = (product: any) => {
    // Dispatch same cart logic
    toast.success(`${product.title} added to cart`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 py-20">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
          <p className="mt-4 text-gray-500 font-semibold">Loading Wishlist...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <main className="bg-[var(--bg-page)] min-h-screen pb-20">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/account" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Heart className="w-6 h-6 text-red-400 fill-red-400" />
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">My Wishlist</h1>
          <span className="ml-auto text-sm text-gray-500 font-medium">
            {wishlistIds.length}/10 saved
          </span>
        </div>

        {fetchError ? (
          <ErrorState message="Failed to load wishlist. Please try again." />
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <EmptyState message="Your wishlist is empty." />
            <Link href="/" className="mt-6 inline-block px-6 py-3 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl transition-all">
              Explore Products
            </Link>
          </div>
        ) : (
          <Pagination items={products} pageSize={12} showPageInfo renderPage={(slice) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {slice.map(product => (
                <div key={product.id} className="relative group">
                  <ProductCard product={product} onAddToCart={handleAddToCart} />
                  {/* Remove from wishlist overlay */}
                  <button
                    onClick={() => handleRemove(product.id)}
                    disabled={removingId === product.id}
                    className="absolute top-2 right-2 z-30 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md text-red-400 hover:text-red-600 hover:bg-white transition-all cursor-pointer disabled:opacity-50"
                    title="Remove from wishlist"
                  >
                    {removingId === product.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )} />
        )}
      </div>
    </main>
  );
}
