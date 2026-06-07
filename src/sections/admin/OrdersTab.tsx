'use client';

import { useState } from 'react';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import PaginationBar from '@/components/PaginationBar';
import OrderDetailModal from '@/components/OrderDetailModal';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { usePagination } from '@/hooks/usePagination';

interface OrdersTabProps {
  orders: any[];
  isFetching: boolean;
  fetchError: boolean;
  viewerUid: string;
  viewerRole: string;
  filter?: (o: any) => boolean;
  showVendorCol?: boolean;
  onRefresh: () => void;
  emptyMessage?: string;
  headerBg?: string;
  title?: string;
  icon?: React.ReactNode;
}

const STATUS_STYLES: Record<string, string> = {
  Pending:   'bg-blue-50 text-blue-600 border-blue-200',
  Approved:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  Rejected:  'bg-red-50 text-red-500 border-red-200',
  Delivered: 'bg-purple-50 text-purple-600 border-purple-200',
};

const STATUS_DOT: Record<string, string> = {
  Pending:   'bg-blue-400',
  Approved:  'bg-emerald-500',
  Rejected:  'bg-red-400',
  Delivered: 'bg-purple-500',
};

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-5">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function OrdersTab({
  orders, isFetching, fetchError, viewerUid, viewerRole,
  filter, showVendorCol = false, onRefresh,
  emptyMessage = 'No orders found.',
  headerBg = 'from-gray-50 to-white',
  title = 'Orders',
  icon,
}: OrdersTabProps) {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const displayOrders = filter ? orders.filter(filter) : orders;
  const { page, setPage, totalPages, slice, total } = usePagination(displayOrders, 10);
  const cols = showVendorCol ? 6 : 5;

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r ${headerBg}`}>
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-white/80 border border-gray-100 flex items-center justify-center shadow-sm">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-400">{total} records</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Order ID</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Customer</th>
              {showVendorCol && <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Vendor</th>}
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Amount</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider">Status</th>
              <th className="py-3 px-5 font-semibold text-gray-400 text-xs uppercase tracking-wider text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={cols} />)
            ) : fetchError ? (
              <tr><td colSpan={cols}><ErrorState message="Failed to load orders." /></td></tr>
            ) : displayOrders.length === 0 ? (
              <tr><td colSpan={cols}><EmptyState message={emptyMessage} /></td></tr>
            ) : (
              slice.map(o => (
                <tr
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  className="border-b border-gray-50 hover:bg-indigo-50/20 transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <span className="font-bold text-gray-800 text-xs font-mono">{o.orderId}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-gray-500 text-xs max-w-[180px] truncate">{o.customerEmail}</td>
                  {showVendorCol && (
                    <td className="py-4 px-5">
                      <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono text-gray-500">
                        {!o.vendorId || o.vendorId === 'admin' ? 'Admin' : o.vendorId.substring(0, 8) + '…'}
                      </span>
                    </td>
                  )}
                  <td className="py-4 px-5 font-bold text-gray-900">₹{Number(o.totalAmount).toLocaleString('en-IN')}</td>
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[o.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[o.status] || 'bg-gray-400'}`} />
                      {o.status}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3" /> Open
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={10} setPage={setPage} />
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          viewerUid={viewerUid}
          viewerRole={viewerRole}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={() => { setSelectedOrder(null); onRefresh(); }}
        />
      )}
    </>
  );
}
