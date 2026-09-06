'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, ChevronRight, Heart, MapPin, Phone, Trash2, Plus, Package, Edit3, X } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Link from 'next/link';
import { useGeolocatedAddress } from '@/hooks/useGeolocatedAddress';

const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 hover:border-gray-300 disabled:opacity-70 disabled:bg-gray-100 disabled:cursor-not-allowed";

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const router = useRouter();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ fullName: '', phone: '', address: '', city: '', state: '', pincode: '' });
  const [savingAddress, setSavingAddress] = useState(false);
  const { detect: detectAddrLocation, detecting: detectingAddrLoc } = useGeolocatedAddress({ onError: (msg) => toast.error(msg) });
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // Auto-fetch City and State from Pincode
  useEffect(() => {
    const fetchPincode = async () => {
      const pin = newAddress.pincode.replace(/\D/g, '');
      if (pin.length === 6) {
        setPincodeLoading(true);
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
          const data = await res.json();
          if (data && data[0]?.Status === 'Success') {
            const postOffice = data[0].PostOffice[0];
            setNewAddress(prev => ({
              ...prev,
              city: postOffice.District || postOffice.Block || prev.city,
              state: postOffice.State || prev.state
            }));
          } else {
            toast.error('Invalid Pincode entered');
          }
        } catch (err) {
          console.error('Failed to fetch pincode data', err);
        } finally {
          setPincodeLoading(false);
        }
      }
    };
    fetchPincode();
  }, [newAddress.pincode]);

  const autoFillAddressLocation = async () => {
    try {
      const parsed = await detectAddrLocation();
      setNewAddress(prev => ({
        ...prev,
        address: parsed.streetAddress || prev.address,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        pincode: parsed.pincode || prev.pincode
      }));
      toast.success('Location fields autofilled!');
    } catch {
      // error toast already shown by the hook
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    storeName: '',
    phone: '',
    gstNumber: '',
    address: '',
  });

  const { refreshUser } = useAuth();

  const handleOpenEdit = async () => {
    setProfileForm({
      name: user?.name || '',
      storeName: '',
      phone: '',
      gstNumber: '',
      address: '',
    });

    if (user?.role === 'vendor') {
      setEditLoading(true);
      try {
        const res = await api.get('/vendors/me');
        const v = res.data;
        setProfileForm({
          name: '',
          storeName: v.storeName || '',
          phone: v.phone || '',
          gstNumber: v.gstNumber || '',
          address: v.address || '',
        });
      } catch {
        toast.error('Failed to load vendor details');
      } finally {
        setEditLoading(false);
      }
    }
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      if (user?.role === 'vendor') {
        await api.put('/vendors/me', {
          storeName: profileForm.storeName,
          phone: profileForm.phone,
          gstNumber: profileForm.gstNumber,
          address: profileForm.address,
        });
      } else {
        await api.put('/user/profile', { name: profileForm.name });
      }
      await refreshUser();
      toast.success('Account details updated!');
      setShowEditModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update details');
    } finally {
      setSavingAddress(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push('/signin');
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setFetchError(false);
    try {
      const res = await api.get('/user/addresses');
      const addrs = res.data;
      setAddresses(addrs);
      if (user.role === 'buyer' && addrs.length === 0) {
        setShowAddForm(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(newAddress.pincode.trim())) {
      toast.error('Please enter a valid 6-digit Pincode.');
      return;
    }
    
    setSavingAddress(true);
    try {
      await api.post('/user/addresses', newAddress);
      toast.success('Address saved!');
      setShowAddForm(false);
      setNewAddress({ fullName: '', phone: '', address: '', city: '', state: '', pincode: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.delete(`/user/addresses/${id}`);
      toast.success('Address removed');
      fetchData();
    } catch {
      toast.error('Failed to delete address');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 py-20">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
          <p className="mt-4 text-gray-500 font-semibold">Loading Account...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const inputCls = "w-full px-4 py-3 sm:py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm outline-none transition-all focus:bg-white focus:border-gold-primary focus:ring-4 focus:ring-gold-primary/10";

  return (
    <main className="bg-gray-50/50 sm:bg-[var(--bg-page)] min-h-screen pb-[90px] sm:pb-20">
      <Navbar />

      <div className="max-w-4xl mx-auto sm:px-6 py-0 sm:py-10">

        {/* Profile Banner (Native Feel on Mobile) */}
        <div className="bg-[#0d1117] -mt-2 sm:rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-md">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-sky-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gold-primary to-amber-600 flex items-center justify-center text-2xl sm:text-3xl border-2 border-white/20 shadow-lg flex-shrink-0">
                👤
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate tracking-wide">{user.name || 'User'}</h2>
                <p className="text-white/60 text-sm mt-0.5 truncate">{user.email}</p>
                <span className="mt-2.5 text-[10px] sm:text-xs font-bold tracking-widest bg-white/10 text-gold-primary px-3 py-1 rounded-full uppercase inline-block border border-gold-primary/30 backdrop-blur-md">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full sm:rounded-xl border border-white/10 transition-all cursor-pointer flex-shrink-0 backdrop-blur-sm"
            >
              <Edit3 className="w-4 h-4 sm:mr-2 text-white" /> 
              <span className="hidden sm:inline text-sm font-semibold text-white">Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Warning Banner if No Address */}
        {!authLoading && !loading && user?.role === 'buyer' && addresses.length === 0 && (
          <div className="mx-4 sm:mx-0 mt-6 bg-amber-50 border border-amber-200 text-amber-900 px-4.5 py-4.5 rounded-2xl shadow-sm flex items-start gap-3.5 animate-in slide-in-from-top-1 duration-200">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-sm text-amber-950">Add a Shipping Address</p>
              <p className="text-xs text-amber-800 mt-1 leading-normal">
                Please add at least one shipping address to your account to complete your profile setup and enable checkout services.
              </p>
            </div>
          </div>
        )}

        <div className="px-4 sm:px-0 mt-6 sm:mt-8">
          {/* Quick Links (Settings Style) */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Settings</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              <Link href="/account/orders" className="flex items-center p-4 active:bg-gray-50 hover:bg-gray-50/50 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mr-3.5">
                  <Package className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-sm">My Orders</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </Link>
              
              <Link href="/account/wishlist" className="flex items-center p-4 active:bg-gray-50 hover:bg-gray-50/50 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mr-3.5">
                  <Heart className="w-4.5 h-4.5 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-sm">My Wishlist</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Address Book Section */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-3 px-1">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Address Book</h3>
              {addresses.length >= 3 ? (
                <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100">
                  Limit: 3/3
                </span>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 text-gold-primary hover:text-gold-hover active:scale-95 font-bold text-sm transition-transform cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-2" /> Add New
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {fetchError ? (
                <div className="col-span-full"><ErrorState message="Failed to load addresses." /></div>
              ) : addresses.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-gray-100 shadow-sm py-8">
                  <EmptyState message="No addresses saved yet." />
                </div>
              ) : (
                addresses.map((addr, index) => (
                  <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col relative">
                    <div className="p-4 sm:p-5 flex-1">
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gold-primary" />
                          <h3 className="font-extrabold text-gray-900 text-sm truncate">{addr.fullName}</h3>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                        {addr.address}<br />
                        {addr.city}, {addr.state} <span className="font-bold text-gray-900">{addr.pincode}</span>
                      </p>
                      <div className="flex items-center gap-2 text-[12px] text-gray-500 font-medium">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{addr.phone}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-50 bg-gray-50/50">
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 active:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Address
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Address Modal (Bottom Sheet on Mobile) */}
      {showAddForm && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <div className="bg-white rounded-t-[2rem] sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-300 pb-safe">
            <div className="w-full flex justify-center pt-3 pb-1 bg-white sm:hidden flex-shrink-0 rounded-t-[2rem]">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-extrabold text-gray-900">Add New Address</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1.5 text-gray-400 hover:text-gray-650 hover:bg-gray-100 active:scale-90 rounded-lg transition-all cursor-pointer bg-gray-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAddress} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <button
                  type="button"
                  onClick={autoFillAddressLocation}
                  disabled={detectingAddrLoc}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50/50 hover:bg-blue-50 active:bg-blue-100 border border-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <MapPin className="w-4 h-4" />
                  {detectingAddrLoc ? 'Detecting Location...' : 'Use Current Location'}
                </button>
              </div>
              <div className="space-y-3">
                <input required placeholder="Full Name" value={newAddress.fullName} onChange={e => setNewAddress({ ...newAddress, fullName: e.target.value })} className={inputCls} />
                <input required placeholder="Phone Number (10 digits)" type="tel" value={newAddress.phone} onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })} className={inputCls} />
                <textarea required placeholder="House/Flat No., Street, Landmark" value={newAddress.address} onChange={e => setNewAddress({ ...newAddress, address: e.target.value })} className={`${inputCls} resize-none`} rows={3} />
                <input required placeholder="City" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} className={inputCls} />
                <div className="flex gap-3">
                  <input required placeholder="State" value={newAddress.state} readOnly={pincodeLoading} onChange={e => setNewAddress({ ...newAddress, state: e.target.value })} className={`${inputCls} w-1/2`} />
                  <input required placeholder="Pincode (6 digits)" maxLength={6} pattern="\d{6}" title="6-digit Pincode" value={newAddress.pincode} onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '') })} className={`${inputCls} w-1/2`} />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={savingAddress} className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover active:scale-[0.98] text-text-main text-sm font-extrabold rounded-xl transition-transform cursor-pointer disabled:opacity-50 shadow-sm hover:shadow-md">
                  {savingAddress ? 'Saving Address...' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal (Bottom Sheet on Mobile) */}
      {showEditModal && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <div className="bg-white rounded-t-[2rem] sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-300 pb-safe">
            <div className="w-full flex justify-center pt-3 pb-1 bg-white sm:hidden flex-shrink-0 rounded-t-[2rem]">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-extrabold text-gray-900">Edit Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 text-gray-400 hover:text-gray-650 hover:bg-gray-100 active:scale-90 rounded-lg transition-all cursor-pointer bg-gray-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4 overflow-y-auto flex-1">
              {editLoading ? (
                <div className="flex flex-col items-center py-10 justify-center">
                  <Loader2 className="w-8 h-8 text-gold-primary animate-spin" />
                  <p className="text-xs text-gray-500 mt-2 font-medium">Loading details...</p>
                </div>
              ) : (
                <>
                  {user?.role !== 'vendor' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Display Name</label>
                      <input type="text" required value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className={inputCls} placeholder="Your Name" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Store Name</label>
                        <input type="text" required value={profileForm.storeName} onChange={e => setProfileForm({ ...profileForm, storeName: e.target.value })} className={inputCls} placeholder="Store Name" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Phone Number</label>
                        <input type="tel" disabled value={profileForm.phone} className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 text-gray-400 rounded-xl text-sm outline-none cursor-not-allowed font-medium" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">GSTIN (Optional)</label>
                        <input type="text" value={profileForm.gstNumber} onChange={e => setProfileForm({ ...profileForm, gstNumber: e.target.value })} className={inputCls} placeholder="GST Number" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Business Address</label>
                        <textarea required rows={2} value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} className={inputCls} placeholder="Full Address" />
                      </div>
                    </>
                  )}
                  <div className="pt-4">
                    <button type="submit" disabled={savingAddress} className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover active:scale-[0.98] text-text-main font-extrabold rounded-xl transition-transform cursor-pointer disabled:opacity-50 shadow-sm hover:shadow-md">
                      {savingAddress ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}