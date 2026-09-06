'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Phone, CheckCircle, Loader2 } from 'lucide-react';

export default function PhoneVerification({ onVerified }: { onVerified: () => void }) {
  const { refreshUser } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'checkout-recaptcha', {
      size: 'invisible',
      callback: () => {},
    });
    verifier.render().then((widgetId) => {
      recaptchaWidgetIdRef.current = widgetId;
    });
    recaptchaVerifierRef.current = verifier;
    return () => {
      verifier.clear();
      recaptchaVerifierRef.current = null;
      recaptchaWidgetIdRef.current = null;
    };
  }, []);

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaVerifierRef.current) return;
    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setOtpStep(true);
      toast.success('OTP sent to your phone.');
    } catch (err: any) {
      console.error(err);
      if (recaptchaWidgetIdRef.current !== null) {
        (window as any).grecaptcha?.reset(recaptchaWidgetIdRef.current);
      } else {
        recaptchaVerifierRef.current?.render().then((widgetId) => {
          (window as any).grecaptcha?.reset(widgetId);
          recaptchaWidgetIdRef.current = widgetId;
        });
      }
      toast.error(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      await api.post('/auth/verify-phone', { idToken });
      await refreshUser();
      toast.success('Phone number verified successfully!');
      onVerified();
    } catch (err: any) {
      console.error(err);
      toast.error('Invalid OTP or verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Phone className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verify Your Phone Number</h2>
          <p className="text-sm text-gray-500 mt-1">Please verify your phone number to proceed with checkout.</p>
        </div>
      </div>

      <div id="checkout-recaptcha"></div>

      {!otpStep ? (
        <form onSubmit={requestOTP} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:border-gold-primary focus:ring-4 focus:ring-gold-primary/10 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover active:bg-gold-primary/80 text-text-main font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOTP} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Enter OTP</label>
            <input
              type="text"
              placeholder="6-digit code"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:border-gold-primary focus:ring-4 focus:ring-gold-primary/10 transition-all text-center tracking-[5px]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gold-primary hover:bg-gold-hover active:bg-gold-primary/80 text-text-main font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Verify & Continue</>}
          </button>
          <button
            type="button"
            onClick={() => setOtpStep(false)}
            className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors mt-2 cursor-pointer bg-transparent border-none"
          >
            Change Phone Number
          </button>
        </form>
      )}
    </div>
  );
}
