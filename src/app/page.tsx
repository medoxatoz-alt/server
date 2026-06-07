'use client';

import { useEffect, useState, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/ProductCard';
import api from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';

function ProductSkeleton() {
  return (
    <div className="bg-white p-3 sm:p-5 rounded-lg flex flex-col justify-between relative border border-gray-200 animate-pulse">
      {/* Image Frame Skeleton */}
      <div className="h-[160px] sm:h-[240px] w-full bg-gray-100 rounded-md mb-4" />
      
      {/* Details Section Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Title Lines */}
        <div className="h-4 bg-gray-100 rounded w-5/6 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
        
        {/* Price & Add to Cart Section */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
          {/* Pricing */}
          <div className="flex flex-col gap-1 w-1/3">
            <div className="h-3 bg-gray-100 rounded w-2/3" />
            <div className="h-5 bg-gray-100 rounded w-full" />
          </div>
          {/* Button */}
          <div className="h-8 w-16 bg-gray-100 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function HomeContent() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.toLowerCase() || '';
  
  const { user } = useAuth();
  const router = useRouter();

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        setProducts(res.data);
      } catch (err) {
        console.error('Failed to fetch products', err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = async (product: any) => {
    if (!user) {
      toast('Please sign in to add to cart');
      router.push('/signin');
      return;
    }
    try {
      await api.post(`/cart/${product.id}`);
      toast.success('Added to Cart!');
      // Dispatch custom event to notify Navbar and other components to update badge count
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      toast.error('Failed to add to cart');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-20">
      <Navbar />

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-[#1e2226] to-nav-bg pt-10 pb-[150px] md:pb-[180px] flex justify-center relative mb-[-120px]">
        <div className="w-full max-w-[1500px] px-5 text-white z-[2]">
          <h1 className="text-4xl md:text-[2.8rem] mb-2.5 font-light leading-tight">
            Equipping India's <span className="text-gold-primary font-bold">Clinics</span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg">Premium Medical Supplies Delivered Fast.</p>
        </div>
        <div className="absolute bottom-0 w-full h-[150px] bg-gradient-to-b from-transparent to-[var(--bg-page)] z-[1]"></div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1500px] mx-auto p-3 sm:p-5 relative z-[5]">
   

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6 mb-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : fetchError ? (
          <ErrorState message="Failed to load products. Please try again later." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6 mb-10">
            {(() => {
              const filteredProducts = products.filter(p => {
                const t = p.title?.toLowerCase() || '';
                const c = p.category?.toLowerCase() || '';
                return t.includes(searchQuery) || c.includes(searchQuery);
              });

              if (filteredProducts.length === 0) {
                return (
                  <div className="col-span-full">
                    <EmptyState message="No products found matching your search." />
                  </div>
                );
              }

              const itemsPerPage = 20;
              const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
              const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

              return (
                <>
                  {paginatedProducts.map(p => (
                    <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
                  ))}

                  {/* Pagination Controls */}
                  <div className="col-span-full flex justify-center items-center gap-3.75 mt-7.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`py-2.5 px-5 font-bold rounded cursor-pointer transition-all duration-200 border ${currentPage === 1
                          ? 'bg-gray-100 text-gray-400 border-gray-250 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 active:scale-95'
                        }`}
                    >
                      Previous
                    </button>

                    <span className="font-bold text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`py-2.5 px-5 font-bold rounded cursor-pointer transition-all duration-200 border ${currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 border-gray-250 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 active:scale-95'
                        }`}
                    >
                      Next
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
