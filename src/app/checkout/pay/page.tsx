'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { load } from '@cashfreepayments/cashfree-js';
import { Loader2, XCircle } from 'lucide-react';

// Reached only from the Medox app: CheckoutModal posts a message to the native
// app instead of calling cashfree.checkout() inline, and the app opens this URL
// in the system browser (a fresh tab, no prior WebView state). Running the whole
// Cashfree flow starting here -- rather than mid-flight inside the embedded
// WebView -- means the checkout's own hidden-form POST, cookies, and UPI-intent
// launches all happen in one continuous real-browser session from the start.
// This page never needs the site's own login session (it runs in a separate,
// unauthenticated browser tab) -- `session` alone is enough for Cashfree.
function PayContent() {
  const searchParams = useSearchParams();
  const session = searchParams.get('session');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) {
      setError('Missing payment session.');
      return;
    }

    let cancelled = false;

    load({
      mode: process.env.NEXT_PUBLIC_CASHFREE_ENV?.toUpperCase() === 'PRODUCTION' ? 'production' : 'sandbox',
    }).then((cashfree) => {
      if (cancelled || !cashfree) return;
      return cashfree.checkout({ paymentSessionId: session, redirectTarget: '_self' });
    }).then((result: any) => {
      if (cancelled) return;
      if (result?.error) {
        setError(result.error.message || 'Payment failed or was cancelled.');
      }
      // result.redirect / result.paymentDetails: Cashfree's own return_url
      // navigation takes over from here -- nothing left for this page to do.
    }).catch(() => {
      if (!cancelled) setError('Failed to load the payment gateway.');
    });

    return () => { cancelled = true; };
  }, [session]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center min-h-screen">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-4 tracking-tight">Something went wrong</h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center min-h-screen">
      <Loader2 className="w-16 h-16 text-gold-primary animate-spin mb-6" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading Payment...</h1>
    </div>
  );
}

export default function PayPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
        </div>
      }>
        <PayContent />
      </Suspense>
    </main>
  );
}
