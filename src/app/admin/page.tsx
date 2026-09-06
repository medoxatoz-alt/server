'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Loader2, LayoutDashboard, Users, Package, ShoppingBag,
  BarChart3, XCircle, CreditCard, Store, ArrowLeft, FolderTree
} from 'lucide-react';
import AddProductModal from '@/components/AddProductModal';
import VendorsTab from '@/sections/admin/VendorsTab';
import ProductsTab from '@/sections/admin/ProductsTab';
import OrdersTab from '@/sections/admin/OrdersTab';
import AnalyticsTab from '@/sections/admin/AnalyticsTab';
import EditProductModal from '@/components/EditProductModal';
import SubcategoriesTab from '@/sections/admin/SubcategoriesTab';

type Tab = 'vendors' | 'products' | 'orders' | 'all-orders' | 'cancellation-requests' | 'rejected-orders' | 'payments' | 'analytics' | 'vendor-products' | 'subcategories';

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  accent?: 'gold' | 'red' | 'emerald' | 'blue' | 'purple';
  dividerBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'vendors',         label: 'Vendors',          icon: <Users className="w-4 h-4" />,        accent: 'blue' },
  { id: 'subcategories',   label: 'Subcategories',    icon: <FolderTree className="w-4 h-4" />,   accent: 'emerald' },
  { id: 'products',        label: 'My Products',      icon: <Package className="w-4 h-4" />,      accent: 'gold' },
  { id: 'orders',          label: 'My Orders',        icon: <ShoppingBag className="w-4 h-4" />,  accent: 'gold', dividerBefore: true },
  { id: 'all-orders',      label: 'All Orders',        icon: <LayoutDashboard className="w-4 h-4" />, accent: 'blue' },
  { id: 'cancellation-requests', label: 'Cancellations', icon: <XCircle className="w-4 h-4" />,      accent: 'red' },
  { id: 'rejected-orders', label: 'Rejected Orders',   icon: <XCircle className="w-4 h-4" />,      accent: 'red' },
  { id: 'payments',        label: 'Payments',          icon: <CreditCard className="w-4 h-4" />,   accent: 'emerald' },
  { id: 'analytics',       label: 'Analytics',         icon: <BarChart3 className="w-4 h-4" />,    accent: 'purple', dividerBefore: true },
];

const ACCENT_ACTIVE: Record<string, string> = {
  gold:    'bg-amber-500/10  text-amber-400   border-l-amber-400',
  blue:    'bg-blue-500/10   text-blue-400    border-l-blue-400',
  red:     'bg-red-500/10    text-red-400     border-l-red-400',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-l-emerald-400',
  purple:  'bg-purple-500/10 text-purple-400  border-l-purple-400',
  teal:    'bg-teal-500/10   text-teal-400    border-l-teal-400',
};
const ACCENT_INACTIVE = 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-transparent';

const TAB_TITLES: Partial<Record<Tab, string>> = {
  vendors: 'Vendor Management', subcategories: 'Manage Subcategories', products: 'My Products',
  orders: 'My Orders', 'all-orders': 'All Orders',
  'cancellation-requests': 'Cancellation Requests',
  'rejected-orders': 'Rejected Orders', payments: 'Payments Overview',
  analytics: 'Financial Analytics',
};

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('vendors');
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<any | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/signin');
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setActiveTab('analytics');
    }
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setIsFetching(true);
    setFetchError(false);
    try {
      if (activeTab === 'vendors') {
        setVendors((await api.get('/vendors')).data);
      } else if (activeTab === 'products') {
        setProducts((await api.get(`/products/vendor/${user.uid}`)).data);
      } else if (activeTab === 'vendor-products' && selectedVendorId) {
        setProducts((await api.get(`/products/vendor/${selectedVendorId}`)).data);
      } else if (activeTab === 'orders') {
        setOrders((await api.get('/orders/vendor')).data);
      } else if (['all-orders', 'cancellation-requests', 'rejected-orders', 'payments', 'analytics'].includes(activeTab)) {
        setOrders((await api.get('/orders')).data);
      }
    } catch {
      toast.error('Failed to fetch data');
      setFetchError(true);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => { if (user?.role === 'admin') fetchData(); }, [activeTab, selectedVendorId, user]);

  const handleApproveVendor = async (uid: string) => {
    try { await api.patch(`/vendors/${uid}/approve`); toast.success('Vendor approved!'); fetchData(); }
    catch { toast.error('Failed to approve vendor'); }
  };
  const handleRejectVendor = async (uid: string) => {
    try { await api.patch(`/vendors/${uid}/reject`); toast.success('Vendor rejected'); fetchData(); }
    catch { toast.error('Failed to reject vendor'); }
  };
  const handleDeleteProduct = async (id: string) => {
    try { await api.delete(`/products/${id}`); toast.success('Product deleted'); fetchData(); }
    catch { toast.error('Failed to delete product'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
          <p className="mt-3 text-slate-400 text-sm font-medium">Loading Admin Panel…</p>
        </div>
      </div>
    );
  }
  if (!user || user.role !== 'admin') return null;

  const currentTitle = activeTab === 'vendor-products' ? `${selectedVendorName}'s Products` : (TAB_TITLES[activeTab] || '');

  return (
    <>
      {/* Mobile View Block Overlay (EXCEPT for Analytics) */}
      {activeTab !== 'analytics' && (
        <div className="lg:hidden fixed inset-0 z-[5000] bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20">
            <Store className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight mb-2 text-white">Desktop Optimization Required</h1>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
            The Admin Panel contains administrative grids and management options designed for desktop devices. Please log in from a PC to access these sections.
          </p>
          <button 
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-sm transition-all"
          >
            Go Back to Store
          </button>
        </div>
      )}

      <div className={`min-h-screen flex bg-[#f1f5f9] ${activeTab !== 'analytics' ? 'hidden lg:flex' : 'flex w-full'}`}>
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className={`${activeTab === 'analytics' ? 'hidden lg:flex' : 'flex'} w-60 flex-shrink-0 bg-[#0f172a] flex flex-col shadow-2xl`}>
          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center shadow-md">
                <Store className="w-4 h-4 text-amber-900" />
              </div>
              <div>
                <div className="text-white font-extrabold text-sm leading-tight">MedoxAtoZ</div>
                <div className="text-amber-400/60 text-[10px] font-semibold tracking-widest uppercase">Admin</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 overflow-y-auto">
            {NAV_ITEMS.map(({ id, label, icon, accent = 'gold', dividerBefore }) => {
              const isActive = activeTab === id;
              return (
                <div key={id}>
                  {dividerBefore && <div className="h-px bg-white/5 mx-4 my-2" />}
                  <button
                    onClick={() => { setActiveTab(id); setIsFetching(true); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150 border-l-2 cursor-pointer text-left ${
                      isActive ? ACCENT_ACTIVE[accent] : ACCENT_INACTIVE
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
                {user.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-white text-xs font-semibold truncate">{user.email}</div>
                <div className="text-slate-500 text-[10px]">Administrator</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ───────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
            {activeTab === 'vendor-products' && (
              <button
                onClick={() => { setActiveTab('vendors'); setSelectedVendorId(null); setSelectedVendorName(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-lg font-bold text-gray-900">{currentTitle}</h1>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all cursor-pointer"
              >
                ← Back to Store
              </button>
            </div>
          </header>

          <div className="p-6 md:p-8">
            {activeTab === 'vendors' && (
              <VendorsTab
                vendors={vendors} isFetching={isFetching} fetchError={fetchError}
                onApprove={handleApproveVendor} onReject={handleRejectVendor}
                onViewProducts={(uid, name) => { setSelectedVendorId(uid); setSelectedVendorName(name); setActiveTab('vendor-products'); }}
              />
            )}
            {activeTab === 'subcategories' && (
              <SubcategoriesTab isFetching={isFetching} fetchError={fetchError} />
            )}
            {(activeTab === 'products' || activeTab === 'vendor-products') && (
              <>
                <ProductsTab
                  products={products} isFetching={isFetching} fetchError={fetchError}
                  onDelete={handleDeleteProduct} onAdd={() => setIsAddModalOpen(true)}
                  onEdit={(p) => setProductToEdit(p)}
                  showAddButton={activeTab === 'products'}
                />
                <AddProductModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={fetchData} />
                <EditProductModal 
                  isOpen={!!productToEdit} 
                  product={productToEdit} 
                  onClose={() => setProductToEdit(null)} 
                  onSuccess={fetchData} 
                />
              </>
            )}
            {activeTab === 'orders' && (
              <OrdersTab
                orders={orders} isFetching={isFetching} fetchError={fetchError}
                viewerUid={user.uid} viewerRole="admin" onRefresh={fetchData}
                title="My Orders" icon={<ShoppingBag className="w-4 h-4 text-amber-600" />}
                emptyMessage="No orders yet."
              />
            )}
            {activeTab === 'all-orders' && (
              <OrdersTab
                orders={orders} isFetching={isFetching} fetchError={fetchError}
                viewerUid={user.uid} viewerRole="admin" showVendorCol onRefresh={fetchData}
                title="All Orders" icon={<LayoutDashboard className="w-4 h-4 text-blue-600" />}
              />
            )}
            {activeTab === 'cancellation-requests' && (
              <OrdersTab
                orders={orders} isFetching={isFetching} fetchError={fetchError}
                viewerUid={user.uid} viewerRole="admin"
                filter={o => o.status === 'Cancellation Requested'} showVendorCol onRefresh={fetchData}
                title="Cancellation Requests" icon={<XCircle className="w-4 h-4 text-red-600" />}
                emptyMessage="No cancellation requests." headerBg="from-red-50 to-white"
              />
            )}
            {activeTab === 'rejected-orders' && (
              <OrdersTab
                orders={orders} isFetching={isFetching} fetchError={fetchError}
                viewerUid={user.uid} viewerRole="admin"
                filter={o => o.status === 'Rejected'} showVendorCol onRefresh={fetchData}
                title="Rejected Orders" icon={<XCircle className="w-4 h-4 text-red-500" />}
                headerBg="from-red-50/60 to-white" emptyMessage="No rejected orders."
              />
            )}
            {activeTab === 'payments' && (
              <OrdersTab
                orders={orders} isFetching={isFetching} fetchError={fetchError}
                viewerUid={user.uid} viewerRole="admin"
                filter={o => o.status === 'Delivered' || o.status === 'Approved'}
                showVendorCol onRefresh={fetchData}
                title="Payments" icon={<CreditCard className="w-4 h-4 text-emerald-600" />}
                headerBg="from-emerald-50/60 to-white" emptyMessage="No payments found."
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsTab orders={orders} isFetching={isFetching} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
