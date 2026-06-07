'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  setPage: (p: number) => void;
  showPageInfo?: boolean;
}

export default function PaginationBar({ page, totalPages, total, pageSize, setPage, showPageInfo = true }: PaginationBarProps) {
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
    add(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
    if (page < totalPages - 2) pages.push('...');
    add(totalPages);
    return pages;
  }, [totalPages, page]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
      {showPageInfo && (
        <p className="text-xs text-gray-400 font-medium">
          Showing <span className="font-bold text-gray-600">{startItem}–{endItem}</span> of{' '}
          <span className="font-bold text-gray-600">{total}</span>
        </p>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-gold-primary hover:text-gold-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pageNumbers.map((p, idx) =>
          p === '...' ? (
            <span key={`e-${idx}`} className="px-1.5 text-gray-300 text-xs select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p as number)}
              className={`min-w-[30px] h-7 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                p === page
                  ? 'bg-gold-primary text-text-main shadow-sm'
                  : 'border border-gray-200 text-gray-500 hover:border-gold-primary hover:text-gold-primary'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-gold-primary hover:text-gold-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
