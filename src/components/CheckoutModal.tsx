'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, MapPin, Lock, X, Plus, Phone } from 'lucide-react';
import { load } from '@cashfreepayments/cashfree-js';
import PhoneVerification from '@/components/PhoneVerification';
import { useGeolocatedAddress } from '@/hooks/useGeolocatedAddress';

export default function CheckoutModal({ isOpen, onClose, buyNowItem }: { isOpen: boolean; onClose: () => void; buyNowItem?: { productId: string, quantity: number } | null }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod] = useState<'CASHFREE'>('CASHFREE');
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const { detect: detectLocation, detecting: detectingLoc } = useGeolocatedAddress({ onError: (msg) => toast.error(msg) });
  const [cashfree, setCashfree] = useState<any>(null);

  const [shipping, setShipping] = useState<{
    id?: string;
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  // Auto-fetch City and State from Pincode (debounced, and ignores stale responses
  // if the pincode changes again before the request resolves)
  useEffect(() => {
    const pin = shipping.pincode?.replace(/\D/g, '');
    if (!useNewAddress || pin?.length !== 6) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (cancelled) return;
        if (data && data[0]?.Status === 'Success') {
          const postOffice = data[0].PostOffice[0];
          setShipping(prev => ({
            ...prev,
            city: postOffice.District || postOffice.Block || prev.city,
            state: postOffice.State || prev.state
          }));
        } else {
          toast.error('Invalid Pincode entered');
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to fetch pincode data', err);
      } finally {
        if (!cancelled) setPincodeLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shipping.pincode, useNewAddress]);

  // Initialize Cashfree SDK
  useEffect(() => {
    const initializeCashfree = async () => {
      try {
        const cf = await load({
          mode: process.env.NEXT_PUBLIC_CASHFREE_ENV?.toUpperCase() === 'PRODUCTION' ? 'production' : 'sandbox',
        });
        setCashfree(cf);
      } catch (err) {
        console.error('Failed to load Cashfree SDK:', err);
      }
    };
    initializeCashfree();
  }, []);

  const autoFillCheckoutLocation = async () => {
    try {
      const parsed = await detectLocation();
      setShipping(prev => ({
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


  useEffect(() => {
    if (isOpen) {
      if (!authLoading && !user) {
        router.push('/signin');
      } else if (user) {
        setShipping(s => ({ ...s, email: user.email }));
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [cartRes, addrRes] = await Promise.all([
        api.get('/cart'),
        api.get('/user/addresses')
      ]);

      const items = buyNowItem ? [buyNowItem] : cartRes.data;
      if (items.length === 0) {
        toast('Your cart is empty');
        onClose();
        return;
      }
      setCartItems(items);

      const savedAddresses = addrRes.data;
      setAddresses(savedAddresses);

      if (savedAddresses.length > 0) {
        setShipping(prev => ({ ...prev, ...savedAddresses[0] }));
      } else {
        setUseNewAddress(true);
        setShipping(s => ({ ...s, fullName: user?.name || '' }));
      }

      const uniqueProductIds: string[] = Array.from(new Set(items.map((i: any) => i.productId)));
      const fetchResults = await Promise.all(uniqueProductIds.map(async (productId) => {
        try {
          const prodRes = await api.get(`/products/${productId}`);
          return { productId, data: prodRes.data, ok: true as const };
        } catch (err) {
          console.error(`Failed to fetch product ${productId}`, err);
          return { productId, ok: false as const };
        }
      }));

      const details: Record<string, any> = {};
      for (const result of fetchResults) {
        if (result.ok) {
          details[result.productId] = result.data;
        } else {
          // Auto-remove unavailable product
          try {
            await api.delete(`/cart/${result.productId}`);
            setCartItems(prev => prev.filter(i => i.productId !== result.productId));
          } catch (delErr) {
            console.error(`Failed to auto-remove unavailable product ${result.productId}`, delErr);
          }
        }
      }
      setProductDetails(details);
    } catch {
      toast.error('Failed to load checkout details');
    } finally {
      setLoading(false);
    }
  }, [user, router, buyNowItem]);

  useEffect(() => {
    if (user && isOpen) fetchData();
  }, [user, isOpen, fetchData]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shipping.fullName?.trim() || !shipping.phone?.trim() || !shipping.address?.trim() || !shipping.city?.trim() || !shipping.state?.trim() || !shipping.pincode?.trim()) {
      toast.error('Please fill in all shipping details.');
      return;
    }

    if (!/^\d{6}$/.test(shipping.pincode.trim())) {
      toast.error('Please enter a valid 6-digit Pincode.');
      return;
    }

    setPlacingOrder(true);

    try {
      if (useNewAddress && shipping.address.trim() !== '') {
        try {
          await api.post('/user/addresses', shipping);
        } catch (e) {
          console.error('Failed to auto-save new address', e);
        }
      }

      const payload = {
        cartItems: cartItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
        shippingDetails: shipping,
      };

      if (paymentMethod === 'CASHFREE') {
        const { data } = await api.post('/payments/cashfree/create-order', payload);

        if (!data.payment_session_id) {
          throw new Error('Failed to create Cashfree session');
        }

        // Inside the Medox app's WebView, don't run Cashfree's checkout here --
        // hand off to the native app, which opens /checkout/pay in the system
        // browser instead. Cashfree's own checkout flow (hidden-form POST,
        // cookies, UPI-intent app launches) needs to run in one continuous real
        // browser session; starting it fresh there rather than mid-flight inside
        // this WebView is what makes that work.
        //
        // cashfreeOrderId is passed along so the app can show /checkout/status
        // for this exact order once it detects the user has returned -- Cashfree
        // won't reliably complete its own return_url redirect back into the app
        // (confirmed: it doesn't navigate to a custom URI scheme), so the app
        // can't wait on that; it acts on its own foreground-return signal instead.
        if (typeof window !== 'undefined' && window.navigator.userAgent.includes('MedoxApp/') && (window as any).ReactNativeWebView) {
          const payUrl = `${window.location.origin}/checkout/pay?session=${encodeURIComponent(data.payment_session_id)}`;
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({
            type: 'open-checkout',
            payload: { url: payUrl, cashfreeOrderId: data.cashfree_order_id },
          }));
          return;
        }

        if (!cashfree) {
          toast.error('Payment gateway is still initializing. Please try again in a moment.');
          setPlacingOrder(false);
          return;
        }

        // Open Cashfree Drop-in Checkout
        const checkoutOptions = {
          paymentSessionId: data.payment_session_id,
          redirectTarget: '_self',
        };

        cashfree.checkout(checkoutOptions).then((result: any) => {
          if (result.error) {
            console.error('Cashfree Error:', result.error);
            toast.error(result.error.message || 'Payment failed or cancelled.');
            setPlacingOrder(false);
          } else if (result.redirect) {
            // Handled by Cashfree SDK natively
          } else if (result.paymentDetails) {
            // Because redirectTarget is '_self', the browser should automatically
            // redirect to our return_url (/checkout/status) upon success.
            console.log('redirect...');
          }
        });
      }

    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong. Please try again.';
      toast.error(msg);
      setPlacingOrder(false);
    }
  };

  const totalAmount = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const p = productDetails[item.productId];
      if (!p) return acc;
      const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/,/g, '')) : Number(p.price);
      return acc + (price * item.quantity);
    }, 0);
  }, [cartItems, productDetails]);

  if (!isOpen) return null;

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-200">
        <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-2xl flex flex-col items-center justify-center py-20 relative shadow-2xl">
          <Loader2 className="w-12 h-12 text-gold-primary animate-spin" />
          <p className="mt-4 text-gray-500 font-semibold tracking-wide">Loading Checkout...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!user.phone) {
    return (
      <div className="fixed inset-0 z-[3000] flex md:items-center md:justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
        
        {/* Modal / Bottom Sheet */}
        <div className="bg-white w-full md:w-auto md:min-w-[450px] md:max-w-xl absolute bottom-0 md:relative md:bottom-auto rounded-t-3xl md:rounded-2xl flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95 duration-300 pb-safe z-10">
          
          <div className="flex justify-end px-4 py-3 md:p-4 pb-0 bg-white relative">
             {/* Mobile Grabber */}
             <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-3 w-12 h-1.5 bg-gray-200 rounded-full" />
             <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors bg-transparent border-none cursor-pointer">
               <X className="w-5 h-5 md:w-5 md:h-5" />
             </button>
          </div>
          
          <div className="px-2 pb-6 md:px-0 md:pb-0">
            <PhoneVerification onVerified={() => fetchData()} />
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="fixed inset-0 z-[3000] bg-gray-100 md:bg-black/60 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center p-0 md:p-6 animate-in fade-in duration-200">
      <div className="bg-gray-100 md:bg-[#f8f9fa] w-full h-full md:h-auto md:max-h-[90vh] md:w-full md:max-w-5xl md:rounded-2xl md:shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* Header with Close Button */}
        <div className="md:bg-white border-b border-gray-100 px-4 py-4 flex justify-between items-center shrink-0 rounded-t-2xl md:rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900 hidden md:flex items-center gap-2">
            Secure Checkout
          </h2>
          <div className="md:hidden"></div> {/* Spacer for mobile */}
          <button onClick={onClose} className="text-gray-900 md:text-gray-400 font-bold md:font-normal text-sm hover:text-gray-900 bg-transparent border-none cursor-pointer tracking-wide">
            <span className="md:hidden">CANCEL</span>
            <X className="hidden md:block w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative md:p-6">
          <div className="flex flex-col lg:flex-row gap-2 md:gap-8 items-start">
            
            {/* Mobile-first Main Column */}
            <div className="flex-1 w-full flex flex-col gap-2.5 md:gap-6 md:bg-transparent">
              
              <form id="checkoutForm" onSubmit={handlePlaceOrder} className="hidden"></form>

              {/* Address Block */}
              <div className="bg-white px-5 py-4 border border-gray-100 rounded-2xl shadow-[var(--shadow-soft)] mx-2 md:mx-0">
                {shipping.address && shipping.fullName ? (
                  <div className="flex items-start gap-4">
                    <MapPin className="w-6 h-6 text-gold-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-[15px] truncate">
                        Delivering to {shipping.fullName}, {shipping.city}
                      </p>
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {shipping.address}, {shipping.state} {shipping.pincode}
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowAddressSelector(true)} 
                      className="text-gold-primary hover:text-gold-hover font-bold text-sm bg-transparent border-none cursor-pointer pl-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                       <span className="font-bold text-gray-900">No Delivery Address</span>
                    </div>
                    <button type="button" onClick={() => setShowAddressSelector(true)} className="text-gold-primary font-bold text-sm bg-transparent border-none cursor-pointer">
                      Add Address
                    </button>
                  </div>
                )}
              </div>

              {/* Continue Button & Trust Badge (Mobile) */}
              <div className="bg-white px-5 py-5 border border-gray-100 rounded-2xl shadow-[var(--shadow-soft)] md:hidden mx-2 mt-2">
                <button
                  type="submit"
                  form="checkoutForm"
                  onClick={handlePlaceOrder}
                  disabled={placingOrder || !shipping.address}
                  className="w-full py-4 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {placingOrder ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{`Continue · Pay ₹${totalAmount.toLocaleString('en-IN')}`}</span>
                  )}
                </button>
                <div className="mt-5 flex items-center gap-3 text-sm text-emerald-800 bg-emerald-50/50 px-4 py-3 rounded-xl border border-emerald-100">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">✓</div>
                  <span className="font-medium leading-tight">Secure Cashfree Payment Gateway. All UPI & Cards supported.</span>
                </div>
              </div>

              {/* Mobile Order Summary */}
              <div className="bg-white px-5 py-5 border border-gray-100 rounded-2xl shadow-[var(--shadow-soft)] md:hidden mx-2 mt-2">
                 <h3 className="font-bold text-gray-900 mb-3">Order Summary</h3>
                 <div className="space-y-2 text-sm text-gray-600">
                   <div className="flex justify-between">
                     <span>Items ({cartItems.length}):</span>
                     <span className="font-medium text-gray-800">₹{totalAmount.toLocaleString('en-IN')}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>Delivery:</span>
                     <span className="text-emerald-600 font-medium">FREE</span>
                   </div>
                   <div className="flex justify-between pt-3 border-t border-gray-100 font-bold text-gray-900 text-base mt-3">
                     <span>Order Total:</span>
                     <span className="text-red-700">₹{totalAmount.toLocaleString('en-IN')}</span>
                   </div>
                 </div>
              </div>
              
              {/* Desktop Only Payment Methods section */}
              <div className="hidden md:block bg-white p-5 border border-gray-200 rounded-xl shadow-sm">
                 <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h2>
                 <div className="flex items-start gap-4 p-4 border-2 border-indigo-500 bg-indigo-50/40 rounded-xl shadow-sm">
                   <div className="flex-1">
                      <p className="font-bold text-gray-900 flex items-center gap-2">
                        Pay Online <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Recommended</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">UPI, Credit/Debit Cards, Net Banking, and Wallets</p>
                   </div>
                 </div>
              </div>

            </div>

            {/* Desktop Sidebar Order Summary */}
            <div className="hidden md:block w-full lg:w-[350px] shrink-0">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-6">
                 <h2 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-100">Order Summary</h2>
                 <div className="border-b border-gray-100 pb-4 mb-4 space-y-3 text-sm text-gray-600">
                   <div className="flex justify-between">
                     <span>Items ({cartItems.length}):</span>
                     <span className="font-semibold text-gray-800">₹{totalAmount.toLocaleString('en-IN')}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>Delivery:</span>
                     <span className="text-emerald-600 font-semibold">FREE</span>
                   </div>
                 </div>
                 <div className="flex justify-between items-end text-xl font-extrabold text-gray-900 mb-6">
                   <span>Order Total:</span>
                   <span className="text-2xl text-red-700">₹{totalAmount.toLocaleString('en-IN')}</span>
                 </div>
                 <button
                   type="submit"
                   form="checkoutForm"
                   onClick={handlePlaceOrder}
                   disabled={placingOrder || !shipping.address}
                   className="w-full py-4 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {placingOrder ? (
                     <Loader2 className="w-5 h-5 animate-spin" />
                   ) : (
                     <span>{`Pay ₹${totalAmount.toLocaleString('en-IN')}`}</span>
                   )}
                 </button>
                 <p className="text-xs text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
                   <Lock className="w-3 h-3" />
                   100% Secure Checkout
                 </p>
               </div>
            </div>
      </div>
      </div>

      {/* Address Selector Bottom Sheet / Overlay */}
      {showAddressSelector && (
        <div className="fixed inset-0 z-[4000] flex md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAddressSelector(false)} />
          <div className="bg-white w-full md:w-[500px] absolute bottom-0 md:relative rounded-t-3xl md:rounded-2xl flex flex-col shadow-2xl max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-300 pb-safe z-10">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 relative bg-white rounded-t-3xl md:rounded-t-2xl z-20">
              <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2.5 w-12 h-1.5 bg-gray-200 rounded-full" />
              <h2 className="text-xl font-bold text-gray-900 mt-2 md:mt-0">Select Address</h2>
              <button onClick={() => setShowAddressSelector(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer border-none mt-2 md:mt-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 custom-scrollbar bg-gray-50 flex-1">
              {addresses.length > 0 && !useNewAddress ? (
                <div className="flex flex-col gap-3">
                  {addresses.map(addr => {
                    const isSelected = shipping.id === addr.id || (shipping.address === addr.address && shipping.pincode === addr.pincode);
                    return (
                      <label
                        key={addr.id}
                        className={`flex gap-3.75 p-4 border rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'border-gold-primary bg-gold-light/20 shadow-sm ring-1 ring-gold-primary/20'
                            : 'border-gray-200 bg-white hover:bg-gray-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="addressSelectionOverlay"
                          checked={isSelected}
                          onChange={() => {
                             setShipping({...shipping, ...addr});
                             setShowAddressSelector(false);
                          }}
                          className="mt-1 cursor-pointer"
                        />
                        <div className="text-gray-700 flex-1">
                          <strong className="text-gray-900 font-bold">{addr.fullName}</strong>
                          <div className="text-sm mt-1 text-gray-600 leading-relaxed">{addr.address}, {addr.city}, {addr.state} {addr.pincode}</div>
                          <div className="text-sm mt-2 text-gray-500 font-medium">Phone: {addr.phone}</div>
                        </div>
                      </label>
                    );
                  })}
                  
                  <button
                    type="button"
                    onClick={() => setUseNewAddress(true)}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-3.5 bg-white border-2 border-dashed border-gray-300 text-gold-primary hover:text-gold-hover font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-5 h-5" /> Add New Address
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  {addresses.length > 0 && (
                     <button
                       type="button"
                       onClick={() => setUseNewAddress(false)}
                       className="text-sm text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none self-start"
                     >
                       ← Back to Saved Addresses
                     </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={autoFillCheckoutLocation}
                    disabled={detectingLoc}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-700 font-bold rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <MapPin className="w-4 h-4" />
                    {detectingLoc ? 'Detecting...' : 'Use Current Location'}
                  </button>
                  
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Full Name</label>
                      <input type="text" value={shipping.fullName} onChange={e => setShipping({...shipping, fullName: e.target.value})} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 focus:bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Phone Number</label>
                      <input type="tel" value={shipping.phone} onChange={e => setShipping({...shipping, phone: e.target.value})} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 focus:bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Complete Address</label>
                      <textarea rows={3} value={shipping.address} onChange={e => setShipping({...shipping, address: e.target.value})} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 focus:bg-white"></textarea>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Pincode</label>
                        <input type="text" maxLength={6} value={shipping.pincode} onChange={e => setShipping({...shipping, pincode: e.target.value.replace(/\D/g, '')})} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 focus:bg-white" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">City</label>
                        <input type="text" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 focus:bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">State</label>
                      <input type="text" readOnly={pincodeLoading} value={shipping.state} onChange={e => setShipping({...shipping, state: e.target.value})} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 disabled:bg-gray-100 disabled:text-gray-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {useNewAddress && (
              <div className="p-5 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddressSelector(false)}
                  disabled={!shipping.address || !shipping.pincode}
                  className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover text-text-main font-bold rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  Save & Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
