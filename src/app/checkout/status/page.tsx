'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function CheckoutStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const cashfreeOrderId = searchParams.get('cashfree_order_id');
  // Set only for checkouts the app opened in the system browser (see
  // server-main's create-order route) -- this page otherwise renders identically
  // whether reached from the app or a plain browser.
  const isApp = searchParams.get('app') === '1';

  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'FAILED'>('LOADING');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/signin');
      return;
    }

    if (!cashfreeOrderId) {
      setStatus('FAILED');
      setErrorMessage('Invalid order ID.');
      return;
    }

    const verifyPayment = async () => {
      try {
        const { data } = await api.post('/payments/cashfree/verify', { cashfree_order_id: cashfreeOrderId });
        
        if (data.success) {
          setStatus('SUCCESS');
          // Clear cart on success
          api.delete('/cart').catch(err => console.error('Failed to clear cart:', err));
        } else {
          setStatus('FAILED');
          setErrorMessage(data.message || 'Payment was not completed successfully.');
        }
      } catch (err: any) {
        setStatus('FAILED');
        setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Verification failed. If money was deducted, it will be refunded.');
      }
    };

    verifyPayment();
  }, [authLoading, user, cashfreeOrderId, router]);

  if (status === 'LOADING') {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center min-h-[60vh]">
        <Loader2 className="w-16 h-16 text-gold-primary animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Payment...</h1>
        <p className="text-gray-500">Please wait while we confirm your order with the bank.</p>
      </div>
    );
  }

  if (status === 'SUCCESS') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center min-h-[60vh]">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Payment Successful!</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          Thank you for your purchase. Your order has been placed successfully.
        </p>
        {isApp ? (
          <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
            <a href="medox://open" className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center">
              Go Back to App
            </a>
            <Link href="/" className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-bold border border-gray-200 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center">
              Continue on Website
            </Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm mx-auto">
            <Link href="/account/orders" className="w-full flex-1 py-3.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center">
              View Orders
            </Link>
            <Link href="/" className="w-full flex-1 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-bold border border-gray-200 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center">
              Continue Shopping
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center min-h-[60vh]">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <XCircle className="w-12 h-12 text-red-500" />
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Payment Failed</h1>
      <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
        {errorMessage || 'Your transaction could not be completed.'}
      </p>
      {isApp ? (
        <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
          <a href="medox://open" className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center">
            Go Back to App
          </a>
          <Link href="/" className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-bold border border-gray-200 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center">
            Continue on Website
          </Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm mx-auto">
          <button onClick={() => window.location.href = '/'} className="w-full flex-1 py-3.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default function CheckoutStatusPage() {
  return (
    <main className="min-h-screen bg-gray-50 pt-20 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <Suspense fallback={
            <div className="flex justify-center items-center h-[50vh]">
              <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
            </div>
          }>
            <CheckoutStatusContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
