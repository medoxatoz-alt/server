'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Firebase Client SDK
import { auth } from '@/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut
} from 'firebase/auth';

function SignInContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false); // false = enter phone, true = enter OTP
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const { refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
      });
    }
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
    try {
      await api.post('/auth/login', { email, password });
      await refreshUser();
      toast.success('Logged in successfully!');
      router.push('/');
    } catch (err: any) {
      if (err.response?.status === 404 && err.response?.data?.code === 'USER_NOT_FOUND') {
        toast.error('Account not found. Redirecting to Sign Up...');
        setTimeout(() => {
          router.push('/signup');
        }, 1500);
      } else {
        toast.error(err.response?.data?.error || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await completeLoginWithBackend(idToken);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Google Login failed.');
      setLoading(false);
    }
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      // signInWithPhoneNumber automatically invokes verify() on the invisible recaptcha
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, (window as any).recaptchaVerifier);
      setConfirmationResult(confirmation);
      setOtpStep(true);
      toast.success('OTP sent to your phone.');
    } catch (err: any) {
      console.error(err);
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
      // We reuse the /auth/google endpoint as it just takes an idToken and creates a session
      await completeLoginWithBackend(idToken);
    } catch (err: any) {
      console.error(err);
      toast.error('Invalid OTP.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white sm:bg-[var(--bg-page)]">
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
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full flex-1 flex flex-col px-2 pt-0 pb-8 sm:flex-none sm:bg-white sm:p-10 sm:rounded-2xl sm:shadow-[var(--shadow-soft)] sm:max-w-[440px] sm:border sm:border-gray-100">
          <div className="text-center mb-8 flex flex-col items-center">
            {/* Logo visible only on small screens because left side has it on large */}
            <a href="/" className="inline-block mb-4 lg:hidden">
              <img src="/logo.webp" alt="MedoxAtoZ Logo" className="h-20 w-auto object-contain" />
            </a>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-2 font-medium">Sign in to your account to continue</p>
          </div>

        {/* Hidden recaptcha container for phone auth */}
        <div id="recaptcha-container"></div>

        {!otpStep ? (
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#2b3036] hover:bg-[#1e2226] text-white hover:text-gold-primary border border-transparent hover:border-gold-primary font-bold rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-white disabled:hover:border-transparent mt-2.5 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                required
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20 text-center tracking-[5px]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#2b3036] hover:bg-[#1e2226] text-white hover:text-gold-primary border border-transparent hover:border-gold-primary font-bold rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-white disabled:hover:border-transparent cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify OTP & Login'}
            </button>
            <button
              type="button"
              onClick={() => setOtpStep(false)}
              className="bg-transparent border-none text-[#007185] hover:text-[#c7511f] hover:underline cursor-pointer text-sm font-semibold transition-colors mt-2"
            >
              Back to Email Login
            </button>
          </form>
        )}

        {!otpStep && (
          <>
            <div className="flex items-center my-5">
              <div className="flex-1 h-[1px] bg-gray-200"></div>
              <div className="px-2.5 text-gray-400 text-xs font-semibold">OR</div>
              <div className="flex-1 h-[1px] bg-gray-200"></div>
            </div>

            <div className="flex flex-col gap-3.75">
              <form onSubmit={requestOTP} className="flex gap-2.5">
                <input
                  type="tel"
                  placeholder="Phone No (e.g. 9876543210)"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  required
                  className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4.5 py-2.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-gray-400 font-bold rounded-xl transition-all text-sm cursor-pointer whitespace-nowrap active:scale-[0.97]"
                >
                  Send OTP
                </button>
              </form>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-gray-400 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-[18px]" />
                <span>Sign in with Google</span>
              </button>
            </div>
          </>
        )}

        <div className="mt-5 text-sm text-center text-gray-500">
          New customer?{' '}
          <Link href="/signup" className="text-[#007185] hover:text-[#c7511f] hover:underline font-bold">
            Start here.
          </Link>
        </div>

        <div className="mt-6 text-xs text-center text-gray-400 leading-normal">
          By continuing, you agree to MedoxAtoZ's Conditions of Use and Privacy Notice.
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
