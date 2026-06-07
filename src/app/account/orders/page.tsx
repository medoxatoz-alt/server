'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import OrderDetailModal from '@/components/OrderDetailModal';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  Pending:   'bg-amber-50 text-amber-700 border-amber-200',
  Approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected:  'bg-red-50 text-red-700 border-red-200',
  Delivered: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/signin');
  }, [user, authLoading, router]);

  const fetchOrders = async () => {
    if (!user) return;
    setFetchError(false);
    try {
      const res = await api.get('/orders/my');
      // Sort newest first
      const sorted = (res.data as any[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 py-20">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
          <p className="mt-4 text-gray-500 font-semibold">Loading Orders...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <main className="bg-[var(--bg-page)] min-h-screen pb-safe sm:pb-20">
      <Navbar />
      
      <div className="max-w-4xl mx-auto sm:px-6 sm:py-10">

        {/* Header - Sticky on mobile for native feel */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 sm:relative sm:bg-transparent sm:border-0 sm:px-0 sm:py-0 flex items-center gap-3 mb-4 sm:mb-8">
          <Link 
            href="/account" 
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6 sm:w-5 sm:h-5" />
          </Link>
          <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 flex-1 sm:flex-none">My Orders</h1>
          <span className="text-sm text-gray-500 font-medium bg-gray-100 sm:bg-transparent px-2.5 py-1 sm:p-0 rounded-lg sm:ml-auto">
            {orders.length} total
          </span>
        </div>

        <div className="px-4 sm:px-0">
          {fetchError ? (
            <ErrorState message="Failed to load orders. Please try again." />
          ) : orders.length === 0 ? (
            <div className="text-center py-20 bg-white sm:bg-transparent rounded-2xl">
              <EmptyState message="You haven't placed any orders yet." />
              <Link href="/" className="mt-6 inline-block px-6 py-3 bg-gold-primary hover:bg-gold-hover active:bg-gold-primary/80 text-text-main font-bold rounded-xl transition-all">
                Start Shopping
              </Link>
            </div>
          ) : (
            <Pagination items={orders} pageSize={8} showPageInfo renderPage={(slice) => (
              <div className="flex flex-col gap-3 sm:gap-4">
                {slice.map(order => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm sm:shadow-[var(--shadow-soft)] overflow-hidden hover:border-gold-primary/30 sm:hover:shadow-md active:bg-gray-50 sm:active:bg-white transition-all cursor-pointer group"
                  >
                    {/* Meta row - Desktop (Amazon Style) */}
                    <div className="hidden sm:flex bg-gray-50 px-5 py-3.5 justify-between border-b border-gray-100 flex-wrap gap-3 text-sm">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Order Placed</div>
                        <div className="font-semibold text-gray-800 mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Total</div>
                        <div className="font-bold text-gray-900 mt-0.5">₹{Number(order.totalAmount).toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Ship To</div>
                        <div className="font-semibold text-[#007185] mt-0.5">{order.shippingDetails?.fullName || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Order # {order.orderId}</div>
                        <div className="mt-1">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block border ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Meta row - Mobile (Native iOS/Android Style) */}
                    <div className="sm:hidden bg-white px-4 pt-4 pb-2 flex justify-between items-start">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border mb-2 inline-block ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {order.status}
                        </span>
                        <div className="text-[13px] text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-extrabold text-gray-900">
                          ₹{Number(order.totalAmount).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          #{order.orderId}
                        </div>
                      </div>
                    </div>

                    {/* Items preview */}
                    <div className="px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 sm:gap-4">
                      <div className="flex -space-x-3">
                        {order.items.slice(0, 3).map((item: any, i: number) => (
                          <img key={i} src={item.image || 'https://via.placeholder.com/40'} alt={item.title}
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-lg border-2 border-white bg-gray-50 p-1" style={{ zIndex: 3 - i }}
                          />
                        ))}
                        {order.items.length > 3 && (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{order.items[0]?.title}</p>
                        {order.items.length > 1 ? (
                          <p className="text-xs text-gray-500 mt-0.5">+ {order.items.length - 1} more item{order.items.length > 2 ? 's' : ''}</p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5">Qty: {order.items[0]?.qty}</p>
                        )}
                      </div>
                      
                      {/* Desktop Action */}
                      <span className="hidden sm:block text-xs text-blue-600 font-semibold group-hover:text-blue-800 flex-shrink-0">
                        View details &rarr;
                      </span>
                      
                      {/* Mobile Chevron (Native feel) */}
                      <ChevronRight className="w-5 h-5 text-gray-300 sm:hidden flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )} />
          )}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          viewerUid={user.uid}
          viewerRole="customer"
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </main>
  );
}