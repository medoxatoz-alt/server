'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

function SignUpContent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const completeSignupWithBackend = async (idToken: string) => {
    try {
      await api.post('/auth/verify', { idToken, name, isSignup: true });
      await refreshUser();
      await signOut(auth); // Clear local firebase state, rely on HTTP cookie
      toast.success('Account created successfully!');
      router.push('/account');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Authentication failed on server.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password });
      await refreshUser();
      toast.success('Account created successfully!');
      router.push('/account');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!name.trim()) {
      toast.error('Please enter your full name first.');
      return;
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await completeSignupWithBackend(idToken);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Google signup failed.');
      setLoading(false);
    }
  };

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name first.');
      return;
    }
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
      await completeSignupWithBackend(idToken); 
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
            Join MedoxAtoZ Today
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
            Create an account to track your orders, save your favorite products, and access exclusive offers tailored for your healthcare needs.
          </p>
          <div className="flex items-center gap-4 text-sm font-semibold text-gold-primary">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✓</span>
              Quick Checkout
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✓</span>
              Order Tracking
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">✓</span>
              Easy Returns
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Form (full width on mobile, half width on lg) */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full flex-1 flex flex-col px-2 pt-0 pb-8 sm:flex-none sm:bg-white sm:p-10 sm:rounded-2xl sm:shadow-[var(--shadow-soft)] sm:max-w-[440px] sm:border sm:border-gray-100">
          <div className="text-center mb-6 flex flex-col items-center">
            {/* Logo visible only on small screens because left side has it on large */}
            <a href="/" className="inline-block mb-4 lg:hidden">
              <img src="/logo.webp" alt="MedoxAtoZ Logo" className="h-20 w-auto object-contain" />
            </a>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Create account</h2>
            <p className="text-sm text-gray-500 mt-2 font-medium">Sign up to get started</p>
          </div>

        {/* Hidden recaptcha container for phone auth */}
        <div id="recaptcha-container"></div>

        <div className="flex flex-col gap-4">
          {/* Full Name input is always visible at the top */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Name / Store Name"
              required
              disabled={otpStep}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
            />
          </div>

          {!otpStep ? (
            <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 chars"
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Confirm</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-[#2b3036] hover:bg-[#1e2226] text-white hover:text-gold-primary border border-transparent hover:border-gold-primary font-bold rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-white disabled:hover:border-transparent mt-1 cursor-pointer"
              >
                {loading ? 'Registering...' : 'Register with Email'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOTP} className="flex flex-col gap-4">
               <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Enter OTP</label>
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
                {loading ? 'Verifying...' : 'Verify OTP & Register'}
              </button>
              <button 
                type="button" 
                onClick={() => setOtpStep(false)}
                className="bg-transparent border-none text-[#007185] hover:text-[#c7511f] hover:underline cursor-pointer text-sm font-semibold transition-colors mt-1"
              >
                Back to Email Signup
              </button>
            </form>
          )}

          {!otpStep && (
            <>
              <div className="flex items-center my-3.5">
                <div className="flex-1 h-[1px] bg-gray-200"></div>
                <div className="px-2.5 text-gray-400 text-xs font-semibold">OR</div>
                <div className="flex-1 h-[1px] bg-gray-200"></div>
              </div>

              <div className="flex flex-col gap-3">
                <form onSubmit={requestOTP} className="flex gap-2">
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
                    className="px-4 py-2.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-gray-400 font-bold rounded-xl transition-all text-sm cursor-pointer whitespace-nowrap active:scale-[0.97]"
                  >
                    Send OTP
                  </button>
                </form>

                <button 
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                  className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 hover:border-gray-400 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-[18px]" />
                  <span>Sign up with Google</span>
                </button>
              </div>
            </>
          )}

          <div className="mt-5 text-xs text-center text-gray-500">
            Already have an account?{' '}
            <Link href="/signin" className="text-[#007185] hover:text-[#c7511f] hover:underline font-bold">
              Sign In
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}

// Add TS interface for recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
