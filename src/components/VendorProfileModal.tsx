'use client';

import { useState, useEffect } from 'react';
import { X, Building2, Phone, Mail, FileText, MapPin, Calendar, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface VendorProfileModalProps {
  vendorId?: string;
  preFetchedVendor?: any;
  onClose: () => void;
}

export default function VendorProfileModal({
  vendorId,
  preFetchedVendor,
  onClose,
}: VendorProfileModalProps) {
  const [vendor, setVendor] = useState<any>(preFetchedVendor || null);
  const [loading, setLoading] = useState(!preFetchedVendor && !!vendorId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preFetchedVendor) {
      setVendor(preFetchedVendor);
      return;
    }

    if (!vendorId) return;

    const fetchVendor = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/vendors/${vendorId}`);
        setVendor(res.data);
      } catch (err: any) {
        const errMsg = err?.response?.data?.error || 'Failed to fetch vendor details.';
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId, preFetchedVendor]);

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          Icon: ShieldCheck,
        };
      case 'rejected':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
          Icon: ShieldAlert,
        };
      default:
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          Icon: Shield,
        };
    }
  };

  const statusInfo = getStatusStyle(vendor?.status || 'pending');
  const StatusIcon = statusInfo.Icon;

  return (
    <div className="fixed inset-0 z-[3100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div className="bg-white rounded-t-[2rem] sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-300 border border-gray-100 pb-safe">
        {/* Mobile Drag Indicator Pill */}
        <div className="w-full flex justify-center pt-3 pb-1 bg-gray-50/80 sm:hidden flex-shrink-0 rounded-t-[2rem]">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Vendor Profile</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-90 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-150 rounded-xl animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-150 rounded w-2/3 animate-pulse" />
                  <div className="h-3 bg-gray-150 rounded w-1/2 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="h-10 bg-gray-100 rounded-xl w-full animate-pulse" />
                <div className="h-10 bg-gray-100 rounded-xl w-full animate-pulse" />
                <div className="h-16 bg-gray-100 rounded-xl w-full animate-pulse" />
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-650 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-gray-800">Error Loading Profile</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
              <button 
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-semibold rounded-lg text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : vendor ? (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center flex-shrink-0 border border-blue-100/50">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-gray-900 text-base leading-snug truncate">
                    {vendor.storeName || 'N/A'}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.bg}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {vendor.status ? vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1) : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="space-y-3.5 pt-4 border-t border-gray-100">
                {/* Email */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                  <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 break-all">{vendor.email || 'N/A'}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                  <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{vendor.phone || 'N/A'}</p>
                  </div>
                </div>

                {/* GST Number */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GST IN</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{vendor.gstNumber || 'Not Provided'}</p>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Business Address</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-relaxed whitespace-pre-wrap">{vendor.address || 'N/A'}</p>
                  </div>
                </div>

                {/* Created At */}
                {vendor.createdAt && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registered On</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">
                        {new Date(vendor.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">No profile data found.</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#2b3036] hover:bg-[#1e2226] text-white hover:text-gold-primary border border-transparent active:scale-95 transition-all font-bold rounded-xl text-sm cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
