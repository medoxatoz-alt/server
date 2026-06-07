'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function VendorRegister() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    storeName: '',
    phone: '',
    gstNumber: '',
    address: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in first');
      router.push('/signin');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/vendors/register', formData);
      await refreshUser();
      toast.success('Registration submitted successfully! Please wait for admin approval.');
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-[var(--bg-page)] min-h-screen pb-20">
      <Navbar />
      
      <div className="max-w-[600px] mx-auto px-4 py-12">
        <div className="bg-white p-8 md:p-10 rounded-2xl shadow-[var(--shadow-soft)] border border-gray-100">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 text-center leading-tight">
            Become a Seller on MedoxAtoZ
          </h1>
          <p className="text-center text-gray-500 mb-8">Reach thousands of clinics across India.</p>

          {!user ? (
            <div className="text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-gray-650 font-medium">You need to sign in to register as a seller.</p>
              <button 
                onClick={() => router.push('/signin')}
                className="px-6 py-2.5 bg-[#2b3036] hover:bg-[#1e2226] text-white hover:text-gold-primary border border-transparent hover:border-gold-primary font-bold rounded-lg transition-all duration-300 shadow-md active:scale-95 cursor-pointer mt-4"
              >
                Sign In Now
              </button>
            </div>
          ) : user.role === 'vendor' ? (
            <div className="text-center p-6 rounded-xl border font-medium">
              {user.status === 'pending' ? (
                <div className="bg-amber-50 text-amber-700 border-amber-100 p-4 rounded-lg">
                  Your seller application is currently <strong className="font-bold">pending approval</strong> by our admin team.
                </div>
              ) : user.status === 'approved' ? (
                <div className="bg-emerald-50 text-emerald-700 border-emerald-100 p-4 rounded-lg flex flex-col items-center">
                  <p className="mb-4">You are already an approved seller!</p>
                  <button 
                    onClick={() => router.push('/vendor/dashboard')}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 text-red-700 border-red-100 p-4 rounded-lg">
                  Your seller application was rejected. Please contact support.
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Store / Company Name *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.storeName}
                  onChange={e => setFormData({...formData, storeName: e.target.value})}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number *</label>
                <input 
                  type="tel" 
                  required 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">GST Number</label>
                <input 
                  type="text" 
                  value={formData.gstNumber}
                  onChange={e => setFormData({...formData, gstNumber: e.target.value})}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Business Address *</label>
                <textarea 
                  required 
                  rows={3}
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-lg transition-all duration-300 shadow-md shadow-amber-500/10 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer mt-2"
              >
                {loading ? 'Submitting...' : 'Register as Seller'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
