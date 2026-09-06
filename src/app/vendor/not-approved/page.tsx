'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Clock, XCircle, AlertCircle, Loader2, ArrowLeft, RefreshCw, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorNotApprovedPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/signin');
        return;
      }
      if (user.role !== 'vendor') {
        router.replace('/');
        return;
      }
      if (user.status === 'approved') {
        router.replace('/vendor/dashboard');
        return;
      }
    }
  }, [user, loading, router]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshUser();
      toast.success('Status checked successfully');
    } catch (err) {
      console.error('Failed to refresh user', err);
      toast.error('Failed to update status');
    } finally {
      setChecking(false);
    }
  };

  if (loading || (user && user.status === 'approved')) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
      </div>
    );
  }

  const isPending = user?.status === 'pending';
  const isRejected = user?.status === 'rejected';

  return (
    <main className="bg-[var(--bg-page)] min-h-screen flex flex-col pb-10">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white w-full max-w-[550px] p-8 md:p-10 rounded-2xl shadow-[var(--shadow-soft)] border border-gray-100 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          
          {/* Status Icon */}
          {isPending ? (
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 mb-6 animate-pulse">
              <Clock className="w-8 h-8" />
            </div>
          ) : isRejected ? (
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-6">
              <XCircle className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
          )}

          {/* Heading */}
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3 tracking-tight">
            {isPending ? 'Application Under Review' : isRejected ? 'Application Rejected' : 'Verification Required'}
          </h1>

          {/* Status details */}
          <p className="text-gray-550 text-sm leading-relaxed mb-8 max-w-sm">
            {isPending
              ? "Your seller registration is currently pending review by our administrator team. We normally complete the verification process within 24–48 hours."
              : isRejected
              ? "We regret to inform you that your seller registration has been rejected after administrative review. If you believe this is a mistake, please reach out to our team."
              : "Your vendor account is not verified. Please contact administrative support to proceed."}
          </p>

          {/* Email / Support info */}
          <div className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 mb-8 flex items-center gap-3.5 text-left text-xs text-slate-650">
            <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <Mail className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800">Need immediate help?</p>
              <p className="mt-0.5">Contact support at <a href="mailto:support@medoxatoz.com" className="text-blue-600 hover:underline font-semibold">support@medoxatoz.com</a></p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full py-3 bg-gold-primary hover:bg-gold-hover text-[#2b3036] font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Refreshing...' : 'Check Status Again'}
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back to Storefront
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
