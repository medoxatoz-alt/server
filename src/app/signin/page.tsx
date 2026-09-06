'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Firebase Client SDK
import { auth } from '@/firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from 'firebase/auth';

function SignInContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'initial' | 'email' | 'phone'>('initial');
  const [otpStep, setOtpStep] = useState(false); // false = enter phone, true = enter OTP
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  const { refreshUser } = useAuth();
  const router = useRouter();

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);

  // Pre-render the invisible reCAPTCHA once on mount per Firebase docs.
  // Store the widgetId so we can reset it on retry instead of recreating.
  useEffect(() => {
    // ReCAPTCHA requires no bypass to allow real SMS testing.

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
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

  const completeLoginWithBackend = async (idToken: string) => {
    try {
      await api.post('/auth/verify', { idToken });
      await refreshUser();
      await signOut(auth); // Clear local firebase state, rely on HTTP cookie
      toast.success('Logged in successfully!');
      router.push('/');
    } catch (err: any) {
      if (err.response?.status === 404 && err.response?.data?.code === 'USER_NOT_FOUND') {
        toast.error('Account not found. Redirecting to Sign Up...');
        setTimeout(() => {
          router.push('/signup');
        }, 1500);
      } else {
        toast.error(err.response?.data?.error || 'Authentication failed on server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsVerification(false);
    try {
      await api.post('/auth/login', { email, password });
      await refreshUser();
      toast.success('Logged in successfully!');
      router.push('/');
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (err.response?.status === 404 && code === 'USER_NOT_FOUND') {
        toast.error('Account not found. Redirecting to Sign Up...');
        setTimeout(() => {
          router.push('/signup');
        }, 1500);
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        toast.error('Please verify your email before signing in.');
        setNeedsVerification(true);
      } else {
        toast.error(err.response?.data?.error || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      toast.success('Verification email sent again.');
    } catch {
      toast.error('Could not resend right now. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaVerifierRef.current) return;
    if (phoneNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setOtpStep(true);
      toast.success('OTP sent to your phone.');
    } catch (err: any) {
      console.error(err);
      // Per Firebase docs: on failure reset the widget so the user can retry
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
      // /auth/verify just takes an idToken and creates a session, regardless of provider
      await completeLoginWithBackend(idToken);
    } catch (err: any) {
      console.error(err);
      toast.error('Invalid OTP.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white sm:bg-[var(--bg-page)] overflow-y-auto">
      {/* Left side: Image/Text (hidden on mobile, visible on lg) */}
      <div className="hidden lg:flex flex-1 bg-[#1e2226] text-white flex-col justify-center px-16 relative overflow-hidden">
        {/* Background Pattern / Shapes */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] rounded-full bg-gold-primary blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[#007185] blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-xl">
   
          <img src="/logo.webp" alt="MedoxAtoZ Logo" className="h-24 w-auto object-contain mb-8 filter " />
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            Your Trusted Health Partner
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
            Access thousands of medical products, manage your orders, and enjoy seamless healthcare delivery right to your doorstep.
          </p>
          <div className="flex items-center gap-4 text-sm font-semibold text-gold-primary">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✓</span>
              Fast Delivery
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✓</span>
              Genuine Products
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✓</span>
              Secure Payments
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Form (full width on mobile, half width on lg) */}
      <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8 relative">
        <a 
          href="/" 
          className="absolute top-4 right-4 sm:top-8 sm:right-8 text-sm font-semibold text-gray-500 hover:text-gold-primary transition-colors flex items-center gap-1.5"
        >
          Sign in Later
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>

        <div className="w-full flex flex-col px-2 pt-0 pb-6 sm:max-w-[440px] mt-8 sm:mt-0">
          <div className="text-center mb-5 sm:mb-8 flex flex-col items-center">
            {/* Logo visible only on small screens because left side has it on large */}
            <a href="/" className="cursor-pointer inline-block mb-3 lg:hidden">
              <img src="/logo.webp" alt="MedoxAtoZ Logo" className="h-14 w-auto object-contain" />
            </a>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1 sm:mt-2 font-medium">Sign in to your account to continue</p>
          </div>

        {/* Hidden recaptcha container for phone auth */}
        <div id="recaptcha-container"></div>

        {!otpStep ? (
          <>
            {loginMethod === 'initial' && (
              <div className="flex flex-col gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setLoginMethod('phone')}
                  className="w-full py-3 sm:py-3.5 bg-white text-gray-800 border border-gray-300 font-semibold rounded-full transition-all flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  <span className="text-[15px]">Continue with phone</span>
                </button>

                <div className="flex items-center my-4 w-full">
                  <div className="flex-1 h-[1px] bg-gray-200"></div>
                  <div className="px-4 text-gray-500 text-xs font-semibold">OR</div>
                  <div className="flex-1 h-[1px] bg-gray-200"></div>
                </div>

                <button
                  type="button"
                  onClick={() => setLoginMethod('email')}
                  className="w-full py-3 sm:py-3.5 bg-white text-gray-800 border border-gray-300 font-semibold rounded-full transition-all flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <span className="text-[15px]">Continue with email</span>
                </button>
              </div>
            )}

            {loginMethod === 'email' && (
              <form onSubmit={handleEmailLogin} className="flex flex-col gap-4 w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-[32px] text-[15px] outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-[32px] text-[15px] outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
                />
                
                <div className="flex justify-end px-2">
                  <Link href="/forgot-password" className="text-sm font-semibold text-gray-600 hover:text-black">
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#0d1117] hover:bg-black text-white font-bold rounded-full transition-all mt-1 active:scale-[0.98] disabled:opacity-50 text-[15px]"
                >
                  {loading ? 'Signing in...' : 'Continue'}
                </button>
                {needsVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={loading}
                    className="text-sm font-semibold text-[#007185] hover:text-[#c7511f] disabled:opacity-50"
                  >
                    Resend verification email
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLoginMethod('initial')}
                  className="text-sm font-semibold text-gray-600 hover:text-black mt-1"
                >
                  Back to options
                </button>
              </form>
            )}

            {loginMethod === 'phone' && (
              <form onSubmit={requestOTP} className="flex flex-col gap-4 w-full">
                <input
                  type="tel"
                  placeholder="Phone No (e.g. 9876543210)"
                  value={phoneNumber}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 10) setPhoneNumber(val);
                  }}
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-[32px] text-[15px] outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#0d1117] hover:bg-black text-white font-bold rounded-full transition-all mt-1 active:scale-[0.98] disabled:opacity-50 text-[15px]"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod('initial')}
                  className="text-sm font-semibold text-gray-600 hover:text-black mt-1"
                >
                  Back to options
                </button>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={verifyOTP} className="flex flex-col gap-5 w-full">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              required
              className="w-full px-4 py-3.5 border border-gray-300 rounded-[32px] text-[15px] outline-none transition-all focus:border-black focus:ring-1 focus:ring-black text-center tracking-[4px]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0d1117] hover:bg-black text-white font-bold rounded-full transition-all active:scale-[0.98] disabled:opacity-50 text-[15px]"
            >
              {loading ? 'Verifying...' : 'Verify OTP & Login'}
            </button>
            <button
              type="button"
              onClick={() => { setOtpStep(false); setOtp(''); }}
              className="text-sm font-semibold text-gray-600 hover:text-black"
            >
              Back
            </button>
          </form>
        )}

        <div className="mt-4 sm:mt-5 text-sm text-center text-gray-500">
          New customer?{' '}
          <Link href="/signup" className="text-[#007185] hover:text-[#c7511f] hover:underline font-bold">
            Start here.
          </Link>
        </div>

        <div className="mt-5 text-xs text-center text-gray-400 leading-normal">
          By continuing, you agree to MedoxAtoZ's{' '}
          <Link href="/terms" className="text-gold-primary hover:underline">Conditions of Use</Link>
          {' '}and{' '}
          <Link href="/privacy-policy" className="text-gold-primary hover:underline">Privacy Notice</Link>.
        </div>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}

// Add TS interface for recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
