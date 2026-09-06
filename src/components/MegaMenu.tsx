'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getCategoriesCached } from '@/lib/api';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, ChevronRight, ChevronLeft, LayoutGrid } from 'lucide-react';

export default function MegaMenu() {
  const [categoriesConfig, setCategoriesConfig] = useState<{
    mainCategories: { id: string, name: string }[], 
    subcategories: Record<string, { id: string, name: string }[]>
  }>({ mainCategories: [], subcategories: {} });
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMobileCat, setExpandedMobileCat] = useState<string | null>(null);
  const [hoveredDesktopCat, setHoveredDesktopCat] = useState<string | null>(null);
  const pathname = usePathname();
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollContainerRef = useRef<HTMLUListElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categoriesConfig.mainCategories.length]);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategoriesCached();
        setCategoriesConfig(data);
      } catch (err) {
        console.error('Failed to fetch categories', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const toggleMobileCat = (catId: string) => {
    setExpandedMobileCat(prev => prev === catId ? null : catId);
  };

  const getCatUrl = (mainCat: { id: string }, subCatId?: string) => {
    let url = `/categories/${encodeURIComponent(mainCat.id)}`;
    if (subCatId) {
      url += `?subCategory=${encodeURIComponent(subCatId)}`;
    }
    return url;
  };

  const handleMouseEnterCat = (catId: string) => {
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    setHoveredDesktopCat(catId);
  };

  const handleMouseLeaveMenu = () => {
    leaveTimeout.current = setTimeout(() => {
      setHoveredDesktopCat(null);
    }, 120);
  };

  const handleMouseEnterPanel = () => {
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
  };

  if (loading) {
    return (
      <div className="bg-[#12161b] border-t border-white/5 py-3">
        <div className="max-w-[1500px] mx-auto px-4 flex gap-6 animate-pulse">
          <div className="w-24 h-5 bg-white/10 rounded"></div>
          <div className="w-32 h-5 bg-white/10 rounded hidden md:block"></div>
          <div className="w-28 h-5 bg-white/10 rounded hidden md:block"></div>
          <div className="w-36 h-5 bg-white/10 rounded hidden lg:block"></div>
        </div>
      </div>
    );
  }

  const { mainCategories, subcategories } = categoriesConfig;
  const activeDropdown = hoveredDesktopCat ? (subcategories[hoveredDesktopCat] || []) : [];
  const activeCat = mainCategories.find(c => c.id === hoveredDesktopCat);
  const isCatActivePage = (catId: string) => pathname === getCatUrl({ id: catId }).split('?')[0];

  return (
    <>
      {/* DESKTOP MENU BAR */}
      <div
        className="bg-[#12161b] border-t border-white/5 relative z-40 hidden md:block"
        onMouseLeave={handleMouseLeaveMenu}
      >
        {/* Nav strip */}
        <div className="max-w-[1500px] mx-auto px-2 lg:px-2 relative group">
          {showLeftScroll && (
            <button
              onClick={() => scrollByAmount(-300)}
              className="absolute left-0 lg:left-4 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-[#12161b] via-[#12161b] to-transparent flex items-center justify-start text-white/50 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 ml-1" />
            </button>
          )}

          <ul 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex items-stretch overflow-x-auto overflow-y-hidden custom-scrollbar" 
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {mainCategories.map((mainCat) => {
              const subs = subcategories[mainCat.id] || [];
              const isHovered = hoveredDesktopCat === mainCat.id;
              const isCurrentPage = isCatActivePage(mainCat.id);
              return (
                <li
                  key={mainCat.id}
                  className="relative"
                  onMouseEnter={() => handleMouseEnterCat(mainCat.id)}
                >
                  <Link
                    href={getCatUrl(mainCat)}
                    className={`h-full flex flex-row items-center justify-center gap-1 px-2 py-3 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 border-b-2 ${
                      isHovered
                        ? 'text-gold-primary border-gold-primary bg-white/[0.03]'
                        : isCurrentPage
                          ? 'text-gold-primary border-gold-primary/50'
                          : 'text-white/70 hover:text-white border-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="whitespace-normal text-center leading-[1.2] max-w-[180px]">
                      {mainCat.name}
                    </span>
                    {subs.length > 0 && (
                      <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isHovered ? 'rotate-180 text-gold-primary' : 'text-white/30'}`} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {showRightScroll && (
            <button
              onClick={() => scrollByAmount(300)}
              className="absolute right-0 lg:right-4 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#12161b] via-[#12161b] to-transparent flex items-center justify-end text-white/50 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 mr-1" />
            </button>
          )}
        </div>

        {/* Full-width Mega Dropdown Panel — Multi-column Subcategory Grid */}
        {hoveredDesktopCat && (
          <div
            className="absolute top-full left-0 right-0 w-full z-50 animate-in fade-in slide-in-from-top-1 duration-150"
            onMouseEnter={handleMouseEnterPanel}
            onMouseLeave={handleMouseLeaveMenu}
          >
            {/* Thin gold connector line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-primary/40 to-transparent" />

            <div className="bg-[#0d1117] border-b border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.65)]">
              <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
                {activeDropdown.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {activeDropdown.map(subCat => (
                      <Link
                        key={subCat.id}
                        href={getCatUrl({ id: hoveredDesktopCat }, subCat.id)}
                        className="group flex items-start text-white/60 hover:text-white text-[13px] font-medium transition-colors"
                      >
                        <span className="truncate group-hover:text-gold-primary transition-colors">{subCat.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3 py-4">
                    <p className="text-[13px] text-white/40">No subcategories available.</p>
                    <Link
                      href={getCatUrl({ id: hoveredDesktopCat })}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-primary/10 border border-gold-primary/30 text-gold-primary text-[12px] font-bold hover:bg-gold-primary/20 transition-colors"
                    >
                      Browse All <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE HEADER TRIGGER */}
      <div className="bg-[#12161b] border-t border-white/5 py-3 px-4 md:hidden flex items-center">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-2 text-white hover:text-gold-primary transition-colors font-medium text-[14px]"
        >
          <Menu className="w-5 h-5" />
          <span className="uppercase tracking-wider font-bold">Categories</span>
        </button>
      </div>

      {/* MOBILE DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[5000] flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-[#0d1117] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-white/10">
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#12161b]">
              <h2 className="text-lg font-bold text-white tracking-widest uppercase">Categories</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {mainCategories.map((mainCat) => {
                const subs = subcategories[mainCat.id] || [];
                const isExpanded = expandedMobileCat === mainCat.id;
                return (
                  <div key={mainCat.id} className="mb-2">
                    <button
                      onClick={() => toggleMobileCat(mainCat.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isExpanded ? 'bg-white/5 border border-white/10' : 'bg-transparent border border-transparent hover:bg-white/5'}`}
                    >
                      <span className={`font-semibold uppercase tracking-wider text-[13px] ${isExpanded ? 'text-gold-primary' : 'text-white/90'}`}>
                        {mainCat.name}
                      </span>
                      {subs.length > 0 ? (
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-gold-primary' : 'text-gray-500'}`} />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    {isExpanded && subs.length > 0 && (
                      <div className="mt-1 mb-2 px-4 py-2 border-l-2 border-gold-primary/30 ml-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        <Link
                          href={getCatUrl(mainCat)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-2 text-sm text-gold-primary font-semibold mb-1"
                        >
                          View All {mainCat.name} →
                        </Link>
                        {subs.map(subCat => (
                          <Link
                            key={subCat.id}
                            href={getCatUrl(mainCat, subCat.id)}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="block py-2.5 text-sm text-gray-400 hover:text-white transition-colors border-b border-white/5 last:border-0"
                          >
                            {subCat.name}
                          </Link>
                        ))}
                      </div>
                    )}
                    {isExpanded && subs.length === 0 && (
                      <div className="mt-1 mb-2 px-4 py-2 ml-4">
                        <Link
                          href={getCatUrl(mainCat)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-2 text-sm text-gold-primary font-semibold"
                        >
                          View All Products →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}} />
    </>
  );
}
