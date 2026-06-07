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

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const router = useRouter();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ fullName: '', phone: '', address: '', city: '', state: '', pincode: '' });
  const [savingAddress, setSavingAddress] = useState(false);
  const [detectingAddrLoc, setDetectingAddrLoc] = useState(false);

  const autoFillAddressLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingAddrLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const address = data.address || {};

          const parts = [
            address.road || address.pedestrian || '',
            address.suburb || address.neighbourhood || address.residential || '',
          ].filter(Boolean);

          const streetAddress = parts.join(', ');
          const city = address.city || address.town || address.village || address.suburb || address.county || '';
          const state = address.state || '';
          const pincode = address.postcode || '';

          setNewAddress(prev => ({
            ...prev,
            address: streetAddress || prev.address,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode || prev.pincode
          }));
          toast.success('Location fields autofilled!');
        } catch {
          toast.error('Failed to resolve location details.');
        } finally {
          setDetectingAddrLoc(false);
        }
      },
      () => {
        toast.error('Location access denied or unavailable.');
        setDetectingAddrLoc(false);
      }
    );
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
    if (!user) return;
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
    <main className="bg-[var(--bg-page)] min-h-screen pb-safe sm:pb-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Header */}
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-6 sm:mb-8 flex items-center gap-3">
          <span className="w-1.5 h-6 sm:h-8 bg-gold-primary rounded-full hidden sm:block" />
          Your Account
        </h1>

        {/* Profile Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm sm:shadow-[var(--shadow-soft)] border-t-4 border-t-gold-primary border-x border-b border-gray-100 flex items-center justify-between gap-4 sm:gap-5 mb-6">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gold-primary/20 to-gold-primary/5 flex items-center justify-center text-2xl border border-gold-primary/20 flex-shrink-0">
              👤
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{user.name || 'User'}</h2>
              <p className="text-gray-500 text-[13px] sm:text-sm mt-0.5 truncate">{user.email}</p>
              <span className="mt-2 text-[10px] sm:text-[11px] font-bold tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md uppercase inline-block border border-blue-100">
                {user.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase bg-gray-50 hover:bg-gold-primary/10 text-gray-650 hover:text-gold-primary rounded-xl border border-gray-200 hover:border-gold-primary/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-10">
          <Link href="/account/orders" className="group bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm sm:shadow-[var(--shadow-soft)] hover:border-gold-primary/40 active:bg-gray-50 sm:hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 mb-0.5">My Orders</div>
              <div className="text-[11px] sm:text-xs text-gray-500 leading-snug">Track deliveries & view history</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gold-primary transition-colors flex-shrink-0" />
          </Link>

          <Link href="/account/wishlist" className="group bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm sm:shadow-[var(--shadow-soft)] hover:border-red-300/40 active:bg-gray-50 sm:hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 mb-0.5">My Wishlist</div>
              <div className="text-[11px] sm:text-xs text-gray-500 leading-snug">Products you've saved for later</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-red-400 transition-colors flex-shrink-0" />
          </Link>
        </div>

        {/* Warning Banner if No Address */}
        {!authLoading && !loading && user?.role === 'buyer' && addresses.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4.5 py-4.5 rounded-2xl mb-6 shadow-sm flex items-start gap-3.5 animate-in slide-in-from-top-1 duration-200">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-sm text-amber-950">Add a Shipping Address</p>
              <p className="text-xs text-amber-800 mt-1 leading-normal">
                Please add at least one shipping address to your account to complete your profile setup and enable checkout services.
              </p>
            </div>
          </div>
        )}

        {/* Address Book Header */}
        <div className="flex justify-between items-end mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Address Book</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">Manage your shipping destinations</p>
          </div>
          {addresses.length >= 3 ? (
            <span className="text-xs text-red-600 font-bold bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100 whitespace-nowrap">
              Limit: 3/3
            </span>
          ) : (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-4 py-2 sm:py-2.5 bg-white text-gray-700 active:bg-gray-100 hover:bg-gray-50 border border-gray-200 shadow-sm font-semibold rounded-xl text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              {showAddForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add New</>}
            </button>
          )}
        </div>

        {/* Add Address Form */}
        {showAddForm && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm mb-6 animate-in slide-in-from-top-2 fade-in duration-200">
            <form onSubmit={handleSaveAddress} className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="col-span-full">
                <button
                  type="button"
                  onClick={autoFillAddressLocation}
                  disabled={detectingAddrLoc}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-700 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <MapPin className="w-4 h-4" />
                  {detectingAddrLoc ? 'Autofilling location details...' : 'Autofill with Current Location'}
                </button>
              </div>
              <input required placeholder="Full Name" value={newAddress.fullName} onChange={e => setNewAddress({ ...newAddress, fullName: e.target.value })} className={inputCls} />
              <input required placeholder="Phone Number (10 digits)" type="tel" value={newAddress.phone} onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })} className={inputCls} />
              <textarea required placeholder="Full Address (House/Flat No., Street, Landmark)" value={newAddress.address} onChange={e => setNewAddress({ ...newAddress, address: e.target.value })} className={`${inputCls} col-span-full resize-none`} rows={2} />
              <input required placeholder="City" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} className={inputCls} />
              <div className="flex gap-3">
                <input required placeholder="State" value={newAddress.state} onChange={e => setNewAddress({ ...newAddress, state: e.target.value })} className={`${inputCls} w-1/2`} />
                <input required placeholder="Pincode" value={newAddress.pincode} onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value })} className={`${inputCls} w-1/2`} />
              </div>
              <div className="col-span-full flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 active:bg-gray-100 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={savingAddress} className="px-6 py-3 bg-gold-primary hover:bg-gold-hover active:bg-gold-primary/80 text-text-main text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 min-w-[140px]">
                  {savingAddress ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Addresses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-10">
          {fetchError ? (
            <div className="col-span-full"><ErrorState message="Failed to load addresses." /></div>
          ) : addresses.length === 0 && !showAddForm ? (
            <div className="col-span-full">
              <EmptyState message="No addresses saved yet." />
            </div>
          ) : (
            addresses.map((addr, index) => (
              <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 shadow-[var(--shadow-soft)] hover:border-gold-primary/30 hover:-translate-y-1 hover:shadow-md active:scale-[0.99] transition-all duration-200 flex flex-col justify-between overflow-hidden group">
                {/* Card Body */}
                <div className="p-5 sm:p-6 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gold-primary bg-gold-primary/10 px-2.5 py-1 rounded-full border border-gold-primary/20">
                      Address {index + 1}
                    </span>
                    <MapPin className="w-4 h-4 text-gray-400 group-hover:text-gold-primary transition-colors duration-300" />
                  </div>

                  <h3 className="font-extrabold text-gray-900 text-base mb-2 truncate">{addr.fullName}</h3>

                  <p className="text-[13px] text-gray-600 leading-relaxed min-h-[50px] mb-3">
                    {addr.address}<br />
                    {addr.city}, {addr.state} <span className="font-bold text-gray-950 font-mono">{addr.pincode}</span>
                  </p>

                  <div className="flex items-center gap-2 text-[13px] text-gray-500 font-medium pt-2 border-t border-gray-50">
                    <Phone className="w-3.5 h-3.5 text-gray-450 flex-shrink-0" />
                    <span>{addr.phone}</span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 active:scale-90 rounded-xl transition-all duration-150 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <div className="bg-white rounded-t-[2rem] sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-300 pb-safe">
            {/* Mobile Drag Indicator Pill */}
            <div className="w-full flex justify-center pt-3 pb-1 bg-gray-50/80 sm:hidden flex-shrink-0 rounded-t-[2rem]">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">Edit Account Details</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 text-gray-400 hover:text-gray-650 hover:bg-gray-100 active:scale-90 rounded-lg transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4 overflow-y-auto flex-1">
              {editLoading ? (
                <div className="flex flex-col items-center py-10 justify-center">
                  <Loader2 className="w-8 h-8 text-gold-primary animate-spin" />
                  <p className="text-xs text-gray-500 mt-2">Loading details...</p>
                </div>
              ) : (
                <>
                  {user?.role !== 'vendor' ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Display Name</label>
                      <input
                        type="text"
                        required
                        value={profileForm.name}
                        onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                        className={inputCls}
                        placeholder="Your Name"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Store / Company Name</label>
                        <input
                          type="text"
                          required
                          value={profileForm.storeName}
                          onChange={e => setProfileForm({ ...profileForm, storeName: e.target.value })}
                          className={inputCls}
                          placeholder="Store Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Phone Number</label>
                        <input
                          type="tel"
                          disabled
                          value={profileForm.phone}
                          className="w-full px-3.5 py-2.5 border border-gray-200 bg-gray-50 text-gray-400 rounded-xl text-sm outline-none cursor-not-allowed font-medium"
                          placeholder="Phone Number"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Logged-in/registered phone number cannot be modified.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">GST Number (Optional)</label>
                        <input
                          type="text"
                          value={profileForm.gstNumber}
                          onChange={e => setProfileForm({ ...profileForm, gstNumber: e.target.value })}
                          className={inputCls}
                          placeholder="GSTIN"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Business Address</label>
                        <textarea
                          required
                          rows={2}
                          value={profileForm.address}
                          onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                          className={inputCls}
                          placeholder="Full Business Address"
                        />
                      </div>
                    </>
                  )}

                  {/* Buttons */}
                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 text-gray-700 font-semibold rounded-xl transition-all text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingAddress}
                      className="flex-1 py-2.5 bg-gold-primary hover:bg-gold-hover active:scale-95 text-text-main font-bold rounded-xl transition-all text-sm cursor-pointer disabled:opacity-50"
                    >
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