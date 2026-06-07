'use client';

import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], pageSize: number, deps?: any[]) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever items change
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, safePage, pageSize, ...(deps || [])]
  );

  return { page: safePage, setPage, totalPages, slice, total: items.length };
}
