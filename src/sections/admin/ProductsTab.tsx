'use client';

import { useState, useEffect } from 'react';
import { getCategoriesCached } from '@/lib/api';
import { Plus, Trash2, Package } from 'lucide-react';
import PaginationBar from '@/components/PaginationBar';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { usePagination } from '@/hooks/usePagination';
import ConfirmActionModal from '@/components/ConfirmActionModal';

interface ProductsTabProps {
  products: any[];
  isFetching: boolean;
  fetchError: boolean;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onEdit?: (product: any) => void;
  showAddButton?: boolean;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-3.5 px-5"><div className="w-11 h-11 bg-gray-100 rounded-xl animate-pulse" /></td>
      <td className="py-3.5 px-5"><div className="h-4 bg-gray-100 rounded w-52 animate-pulse" /></td>
      <td className="py-3.5 px-5"><div className="h-5 bg-gray-100 rounded-full w-24 animate-pulse" /></td>
      <td className="py-3.5 px-5"><div className="h-4 bg-gray-100 rounded w-16 animate-pulse" /></td>
      <td className="py-3.5 px-5"><div className="h-4 bg-gray-100 rounded w-8 ml-auto animate-pulse" /></td>
    </tr>
  );
}

export default function ProductsTab({ products, isFetching, fetchError, onDelete, onAdd, onEdit, showAddButton = true }: ProductsTabProps) {
  const { page, setPage, totalPages, slice, total } = usePagination(products, 10);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  
  const [categoriesConfig, setCategoriesConfig] = useState<{mainCategories: {id: string, name: string}[], subcategories: Record<string, {id: string, name: string}[]>}>({ mainCategories: [], subcategories: {} });
  useEffect(() => {
    getCategoriesCached().then(setCategoriesConfig).catch(console.error);
  }, []);

  const getCategoryName = (id: string, isSub: boolean, mainId?: string) => {
    if (!id) return null;
    if (!isSub) {
      const found = categoriesConfig.mainCategories.find(c => c.id === id);
      return found ? found.name : id.replace(/-/g, ' ');
    } else {
      if (!mainId) return id.replace(/-/g, ' ');
      const subs = categoriesConfig.subcategories[mainId] || [];
      const found = subs.find(s => s.id === id);
      return found ? found.name : id.replace(/-/g, ' ');
    }
  };

  return (
    <div className="space-y-4">
      {showAddButton && (
        <div className="flex justify-end">
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl transition-all shadow-md shadow-amber-200/50 hover:shadow-lg hover:shadow-amber-200/60 active:scale-[0.98] cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Product Catalog</h3>
            <p className="text-xs text-gray-400">{total} products</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Image</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Product</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Category</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Price</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : fetchError ? (
              <tr><td colSpan={5}><ErrorState message="Failed to load products." /></td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5}><EmptyState message="No products yet. Add your first!" /></td></tr>
            ) : (
              slice.map(p => {
                const imgSrc = Array.isArray(p.images) ? p.images[0] : (p.thumbnail || p.image || '');
                const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price);
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-amber-50/20 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="w-11 h-11 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                        <img src={imgSrc || 'https://via.placeholder.com/44'} alt={p.title} className="w-full h-full object-contain p-1" />
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-semibold text-gray-800 line-clamp-1 max-w-[220px] block">{p.title}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold w-max truncate max-w-[120px] capitalize">
                          {p.mainCategory || p.category || getCategoryName(p.mainCategoryId, false) || "Uncategorized"}
                        </span>
                        {(p.subCategory || p.subCategoryId) && (
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded text-[10px] font-medium w-max truncate max-w-[120px] capitalize">
                            {p.subCategory || getCategoryName(p.subCategoryId, true, p.mainCategoryId) || "Uncategorized"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-gray-900">₹{price.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-5 text-right flex justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(p)}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Edit product"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => setProductToDelete(p)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={10} setPage={setPage} />
      </div>

      {productToDelete && (
        <ConfirmActionModal
          title="Delete Product?"
          description={`Product: ${productToDelete.title}`}
          warningText="⚠️ This action is permanent and cannot be undone."
          warningPoints={[
            "The product will be permanently removed from the catalog.",
            "Customers will no longer be able to view or purchase this product.",
            "This action cannot be reverted."
          ]}
          confirmWord="CONFIRM"
          actionButtonLabel="Delete Product"
          actionButtonLabelAnyway="Delete Anyway"
          onConfirm={() => {
            onDelete(productToDelete.id);
            setProductToDelete(null);
          }}
          onCancel={() => setProductToDelete(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
