'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps<T> {
  items: T[];
  pageSize?: number;
  initialPage?: number;
  showPageInfo?: boolean;
  renderPage: (slice: T[]) => React.ReactNode;
}

export default function Pagination<T>({
  items,
  pageSize = 10,
  initialPage = 1,
  showPageInfo = true,
  renderPage,
}: PaginationProps<T>) {
  const [page, setPage] = useState(initialPage);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const slice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const startItem = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, items.length);

  // Build page number array — always show first, last, current ±1, and ellipses
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
    add(1);
    if (safePage > 3) pages.push('...');
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) add(i);
    if (safePage < totalPages - 2) pages.push('...');
    add(totalPages);
    return pages;
  }, [totalPages, safePage]);

  if (items.length === 0) return <>{renderPage([])}</>;

  return (
    <div className="flex flex-col gap-4">
      {renderPage(slice)}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-2 pt-4 border-t border-gray-100">
          {showPageInfo && (
            <p className="text-xs text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-700">{startItem}–{endItem}</span> of{' '}
              <span className="font-bold text-gray-700">{items.length}</span> items
            </p>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gold-primary hover:text-gold-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    p === safePage
                      ? 'bg-gold-primary text-text-main shadow-md shadow-amber-500/20'
                      : 'border border-gray-200 text-gray-600 hover:border-gold-primary hover:text-gold-primary'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gold-primary hover:text-gold-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
