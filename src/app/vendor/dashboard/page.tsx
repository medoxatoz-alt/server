'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Store } from 'lucide-react';
import AddProductModal from '@/components/AddProductModal';
import ProductsTab from '@/sections/admin/ProductsTab';
import OrdersTab from '@/sections/admin/OrdersTab';

type Tab = 'products' | 'orders' | 'rejected-orders';

const TAB_LABELS: Record<Tab, string> = {
  products: 'My Products',
  orders: 'My Orders',
  'rejected-orders': 'Rejected Orders',
};

export default function VendorDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Guard
  useEffect(() => {
    if (!loading && (!user || user.role !== 'vendor' || user.status !== 'approved')) {
      router.replace('/');
      toast.error('Access denied. Approved vendors only.');
    }
  }, [user, loading, router]);

  const fetchData = async () => {
    if (!user) return;
    setIsFetching(true);
    setFetchError(false);
    try {
      if (activeTab === 'products') {
        const res = await api.get(`/products/vendor/${user.uid}`);
        setProducts(res.data);
      } else if (activeTab === 'orders' || activeTab === 'rejected-orders') {
        const res = await api.get('/orders/vendor');
        setOrders(res.data);
      }
    } catch {
      toast.error('Failed to fetch data');
      setFetchError(true);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'vendor' && user?.status === 'approved') fetchData();
  }, [activeTab, user]);

  const handleDeleteProduct = async (id: string) => {
    try { await api.delete(`/products/${id}`); toast.success('Product deleted.'); fetchData(); }
    catch { toast.error('Failed to delete product.'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 font-semibold">Loading Vendor Dashboard...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const sidebarLinks: { id: Tab; label: string; color?: string }[] = [
    { id: 'products', label: 'My Products' },
    { id: 'orders', label: 'My Orders' },
    { id: 'rejected-orders', label: 'Rejected Orders', color: 'red' },
  ];

  const activeColor = (id: Tab, color?: string) => {
    const isActive = activeTab === id;
    if (color === 'red') return isActive ? 'bg-white/10 border-red-500 text-red-400' : 'border-transparent text-[#e1e4e8] hover:bg-white/5 hover:text-red-400';
    return isActive ? 'bg-white/10 border-gold-primary text-gold-primary' : 'border-transparent text-[#e1e4e8] hover:bg-white/5 hover:text-gold-primary';
  };

  return (
    <>
      {/* Mobile View Block Overlay */}
      <div className="lg:hidden fixed inset-0 z-[5000] bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20">
          <Store className="w-8 h-8 text-gold-primary" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight mb-2 text-white">Desktop Optimization Required</h1>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
          The MedoxAtoZ Vendor Portal contains complex metrics, inventory tables, and order controls designed for desktop monitors. Please sign in from a PC to manage your store.
        </p>
        <button 
          onClick={() => router.push('/')}
          className="px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-sm transition-all"
        >
          Go Back to Store
        </button>
      </div>

      <div className="hidden lg:flex min-h-screen bg-[var(--bg-page)]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-[#1a2233] flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-gold-primary font-extrabold text-lg tracking-tight">MedoxAtoZ</h1>
          <p className="text-[11px] text-[#8892a0] mt-0.5 uppercase tracking-widest font-semibold">Vendor Portal</p>
        </div>
        <nav className="flex flex-col py-2 flex-1">
          {sidebarLinks.map(({ id, label, color }) => (
            <div
              key={id}
              onClick={() => { setActiveTab(id); setIsFetching(true); }}
              className={`px-6 py-3.5 cursor-pointer transition-all duration-200 text-sm font-semibold flex items-center gap-3 border-l-4 ${activeColor(id, color)}`}
            >
              {label}
            </div>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10">
          <div className="text-[11px] text-[#8892a0]">Signed in as</div>
          <div className="text-white text-xs font-semibold truncate mt-0.5">{user.email}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">{TAB_LABELS[activeTab]}</h1>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 font-semibold rounded-lg text-sm cursor-pointer">
            Back to Store
          </button>
        </div>

        {activeTab === 'products' && (
          <>
            <ProductsTab
              products={products} isFetching={isFetching} fetchError={fetchError}
              onDelete={handleDeleteProduct} onAdd={() => setIsAddModalOpen(true)}
            />
            <AddProductModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={fetchData} />
          </>
        )}
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} isFetching={isFetching} fetchError={fetchError} viewerUid={user.uid} viewerRole="vendor" onRefresh={fetchData} emptyMessage="No orders yet." />
        )}
        {activeTab === 'rejected-orders' && (
          <OrdersTab orders={orders} isFetching={isFetching} fetchError={fetchError} viewerUid={user.uid} viewerRole="vendor" filter={o => o.status === 'Rejected'} onRefresh={fetchData} emptyMessage="No rejected orders." headerBg="from-red-50/60 to-white" />
        )}
      </div>
    </div>
    </>
  );
}
