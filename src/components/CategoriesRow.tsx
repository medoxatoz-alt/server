'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { usePathname } from 'next/navigation';
import { Menu, X, Search, ChevronRight } from 'lucide-react';

export default function CategoriesRow() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/products');
        const allProducts = res.data || [];
        const uniqueCategories = new Set<string>();
        
        allProducts.forEach((p: any) => {
          if (p.category && typeof p.category === 'string') {
            uniqueCategories.add(p.category.trim());
          }
        });
        
        setCategories(Array.from(uniqueCategories).sort());
      } catch (err) {
        console.error('Failed to fetch categories', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const filteredCategories = categories.filter(c => 
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div 
        className="bg-[#12161b] border-t border-b border-white/5 py-2.5 px-4 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="max-w-[1500px] mx-auto px-3.5 md:px-5 flex items-center gap-6 md:gap-8 text-[14px] whitespace-nowrap [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-white hover:text-gold-primary transition-colors font-medium text-[14px] flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
            Browse Categories
          </button>

          {/* Desktop Preview Categories */}
          <div className="hidden md:flex items-center gap-6 md:gap-8">
            <Link 
              href="/" 
              className={`transition-colors font-medium flex-shrink-0 ${pathname === '/' ? 'text-gold-primary' : 'text-white/70 hover:text-white'}`}
            >
              All Products
            </Link>
            {categories.slice(0, 5).map((category) => {
              const catUrl = `/categories/${encodeURIComponent(category.toLowerCase())}`;
              const isActive = pathname === catUrl;
              return (
                <Link 
                  key={category} 
                  href={catUrl}
                  className={`transition-colors capitalize font-medium flex-shrink-0 ${isActive ? 'text-gold-primary' : 'text-white/70 hover:text-white'}`}
                >
                  {category}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full Screen Dropdown / Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[5000] bg-[#0d1117] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0d1117]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Menu className="w-6 h-6 text-gold-primary" />
              All Categories
            </h2>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 md:p-6 border-b border-white/5 bg-[#12161b]">
            <div className="max-w-4xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search categories..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1117] border border-white/10 rounded-full py-3.5 pl-12 pr-4 text-white outline-none focus:border-gold-primary focus:shadow-[0_0_15px_rgba(212,175,55,0.15)] transition-all text-[15px]"
              />
            </div>
          </div>

          {/* Category List */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0d1117]">
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link 
                href="/" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-gold-primary/50 transition-all group ${pathname === '/' ? 'border-gold-primary bg-gold-primary/10' : ''}`}
              >
                <span className="font-semibold text-white group-hover:text-gold-primary transition-colors">All Products</span>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gold-primary transition-colors" />
              </Link>
              
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[60px] bg-white/5 rounded-xl animate-pulse" />
                ))
              ) : (
                filteredCategories.map((category) => {
                  const catUrl = `/categories/${encodeURIComponent(category.toLowerCase())}`;
                  const isActive = pathname === catUrl;
                  return (
                    <Link 
                      key={category} 
                      href={catUrl}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-gold-primary/50 transition-all group ${isActive ? 'border-gold-primary bg-gold-primary/10' : ''}`}
                    >
                      <span className="font-semibold text-white capitalize group-hover:text-gold-primary transition-colors truncate pr-2">{category}</span>
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gold-primary transition-colors flex-shrink-0" />
                    </Link>
                  );
                })
              )}
              
              {!loading && filteredCategories.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-400">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                    <Search className="w-8 h-8 text-gray-500" />
                  </div>
                  <div className="text-lg font-medium text-white mb-1">No categories found</div>
                  <p className="text-sm text-gray-500">We couldn't find any category matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
