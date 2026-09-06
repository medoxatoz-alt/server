'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/ProductCard';
import api, { getCategoriesCached } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { X } from 'lucide-react';
import React from 'react';

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



export default function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categoryParam } = use(params);
  const categoryStr = decodeURIComponent(categoryParam).toLowerCase();
  const searchParams = useSearchParams();
  const subCategoryQuery = searchParams.get('subCategory');
  
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [categoriesConfig, setCategoriesConfig] = useState<{mainCategories: {id: string, name: string}[], subcategories: Record<string, {id: string, name: string}[]>}>({ mainCategories: [], subcategories: {} });

  const [filters, setFilters] = useState<{
    subcategories: string[];
    brands: string[];
    priceRange: [number, number];
    attributes: Record<string, string[]>;
  }>({
    subcategories: subCategoryQuery ? [subCategoryQuery] : [],
    brands: [],
    priceRange: [0, Number.MAX_SAFE_INTEGER],
    attributes: {}
  });
  
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchProductsAndCategories = async () => {
      try {
        const [prodRes, catData] = await Promise.all([
          api.get('/products'),
          getCategoriesCached()
        ]);
        setAllProducts(prodRes.data || []);
        setCategoriesConfig(catData);
      } catch (err) {
        console.error('Failed to fetch data', err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProductsAndCategories();
  }, []);

  // Ensure subCategory from URL is synced on first load if it changes
  useEffect(() => {
    if (subCategoryQuery && !filters.subcategories.includes(subCategoryQuery)) {
      setFilters(prev => ({ ...prev, subcategories: [...prev.subcategories, subCategoryQuery] }));
    }
  }, [subCategoryQuery]);

  const baseProducts = useMemo(() => {
    return allProducts.filter(p => {
      if (p.mainCategoryId) {
        return p.mainCategoryId === categoryStr;
      }
      // Backwards compat
      const mainCatStr = (p.mainCategory || p.category || '').toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
      return mainCatStr === categoryStr;
    });
  }, [allProducts, categoryStr]);

  const { availableSubcats, availableBrands, counts, maxPrice, availableAttributes } = useMemo(() => {
    const subs = new Set<string>();
    const brands = new Set<string>();
    const attrs: Record<string, Set<string>> = {};
    const c = { 
      subcategories: {} as Record<string, number>, 
      brands: {} as Record<string, number>,
      attributes: {} as Record<string, Record<string, number>>
    };
    let mPrice = 0;

    baseProducts.forEach(p => {
      if (p.price > mPrice) mPrice = p.price;
      
      const subId = p.subCategoryId || p.subCategory;
      if (subId) {
        subs.add(subId);
        c.subcategories[subId] = (c.subcategories[subId] || 0) + 1;
      }
      if (p.brand) {
        brands.add(p.brand);
        c.brands[p.brand] = (c.brands[p.brand] || 0) + 1;
      }

      if (p.attributes && Array.isArray(p.attributes)) {
        p.attributes.forEach((attr: any) => {
          if (attr.key && attr.value) {
            if (!attrs[attr.key]) {
              attrs[attr.key] = new Set();
              c.attributes[attr.key] = {};
            }
            attrs[attr.key].add(attr.value);
            c.attributes[attr.key][attr.value] = (c.attributes[attr.key][attr.value] || 0) + 1;
          }
        });
      }
    });

    // Map subcategory IDs to {id, name}
    const mappedSubcats = Array.from(subs).map(subId => {
      // Find name from config
      const found = categoriesConfig.subcategories[categoryStr]?.find(s => s.id === subId);
      return {
        id: subId,
        name: found ? found.name : subId // Fallback to ID/name if not found
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const formattedAttrs: Record<string, string[]> = {};
    Object.keys(attrs).forEach(key => {
      formattedAttrs[key] = Array.from(attrs[key]).sort();
    });

    return {
      availableSubcats: mappedSubcats,
      availableBrands: Array.from(brands).sort(),
      availableAttributes: formattedAttrs,
      counts: c,
      maxPrice: mPrice || 50000
    };
  }, [baseProducts, categoriesConfig, categoryStr]);

  // Adjust price filter max if it was Infinity
  useEffect(() => {
    if (filters.priceRange[1] === Number.MAX_SAFE_INTEGER && maxPrice > 0) {
      setFilters(prev => ({ ...prev, priceRange: [0, maxPrice] }));
    }
  }, [maxPrice]);

  const filteredProducts = useMemo(() => {
    return baseProducts.filter(p => {
      const subId = p.subCategoryId || p.subCategory;
      if (filters.subcategories.length > 0 && (!subId || !filters.subcategories.includes(subId))) return false;
      if (filters.brands.length > 0 && (!p.brand || !filters.brands.includes(p.brand))) return false;
      if (p.price > filters.priceRange[1]) return false;
      
      if (filters.attributes && Object.keys(filters.attributes).length > 0) {
        for (const key of Object.keys(filters.attributes)) {
          if (filters.attributes[key] && filters.attributes[key].length > 0) {
            const prodAttr = (p.attributes || []).find((a: any) => a.key === key);
            if (!prodAttr || !filters.attributes[key].includes(prodAttr.value)) return false;
          }
        }
      }
      
      return true;
    });
  }, [baseProducts, filters]);

  const handleAddToCart = async (product: any) => {
    if (!user) {
      toast('Please sign in to add to cart');
      router.push('/signin');
      return;
    }
    try {
      await api.post(`/cart/${product.id}`);
      toast.success('Added to Cart!');
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      toast.error('Failed to add to cart');
    }
  };

  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-20">
      <Navbar />

      {/* Hero Banner for Category */}
      <div className="bg-gradient-to-br from-[#1e2226] to-nav-bg pt-10 pb-[80px] md:pb-[100px] flex justify-center relative mb-8">
        <div className="w-full max-w-[1500px] px-5 text-white z-[2]">
          <h1 className="text-4xl md:text-[2.8rem] mb-2.5 font-light leading-tight capitalize">
            {(() => {
              const mainCat = categoriesConfig.mainCategories.find(c => 
                c.id === categoryStr || c.id === categoryStr.replace(/\s+/g, '-') || c.name.toLowerCase() === categoryStr
              );
              const resolvedCatId = mainCat ? mainCat.id : categoryStr;
              const resolvedCatName = mainCat ? mainCat.name : categoryStr.replace(/-/g, ' ');
              const subCatName = categoriesConfig.subcategories[resolvedCatId]?.find(s => s.id === subCategoryQuery)?.name ;
              
              if (subCategoryQuery) {
                return <>{subCatName} <span className="text-gold-primary font-bold">Products</span></>;
              }
              return <>{resolvedCatName} <span className="text-gold-primary font-bold">Products</span></>;
            })()}
          </h1>
          <p className="text-gray-300 text-base md:text-lg">
            {(() => {
              const mainCat = categoriesConfig.mainCategories.find(c => 
                c.id === categoryStr || c.id === categoryStr.replace(/\s+/g, '-') || c.name.toLowerCase() === categoryStr
              );
              const resolvedCatId = mainCat ? mainCat.id : categoryStr;
              const resolvedCatName = mainCat ? mainCat.name : categoryStr.replace(/-/g, ' ');
              const subCatName = categoriesConfig.subcategories[resolvedCatId]?.find(s => s.id === subCategoryQuery)?.name  ;
              
              return `Premium supplies ${subCategoryQuery ? `for ${subCatName} in` : 'for'} ${resolvedCatName}.`;
            })()}
          </p>
        </div>
        <div className="absolute bottom-0 w-full h-[80px] bg-gradient-to-b from-transparent to-[var(--bg-page)] z-[1]"></div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1500px] mx-auto p-3 sm:p-5 relative z-[5]">
        <div className="flex flex-col lg:flex-row gap-6">
          


          {/* Product Grid Area */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6 mb-10">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : fetchError ? (
              <ErrorState message="Failed to load products. Please try again later." />
            ) : filteredProducts.length === 0 ? (
              <EmptyState message={`No products found for these filters.`} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6 mb-10">
                {paginatedProducts.map(p => (
                  <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex justify-center items-center gap-3.75 mt-7.5 mb-10">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`py-2.5 px-5 font-bold rounded cursor-pointer transition-all duration-200 border ${currentPage === 1
                      ? 'bg-gray-100 text-gray-400 border-gray-250 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 active:scale-95'
                    }`}
                >
                  Prev
                </button>
                <span className="text-gray-600 font-medium px-2">Page {currentPage} of {totalPages}</span>
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
            )}
          </div>
        </div>
      </div>


    </main>
  );
}
