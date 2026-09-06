'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase';
import { toast } from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email. Please try again.');
    } finally {
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
            Account Recovery
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
            Don't worry if you forgot your password. Enter your registered email and we'll help you get back into your account securely.
          </p>
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
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Reset Password</h2>
            <p className="text-sm text-gray-500 mt-1 sm:mt-2 font-medium">Enter your email to receive a reset link</p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center text-center p-6 bg-green-50 rounded-xl border border-green-200">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Check your email</h3>
              <p className="text-sm text-gray-600 mb-6">
                We've sent a password reset link to <span className="font-semibold">{email}</span>
              </p>
              <Link 
                href="/signin" 
                className="w-full py-3 bg-[#2b3036] hover:bg-[#1e2226] text-white font-bold rounded-xl transition-all duration-200"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4 sm:gap-5">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 border border-gray-300 rounded-lg text-sm sm:text-[15px] outline-none transition-all focus:border-gold-primary focus:ring-2 focus:ring-gold-primary/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 sm:py-3.5 bg-[#2b3036] hover:bg-[#1e2226] text-white hover:text-gold-primary border border-transparent hover:border-gold-primary font-bold rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1.5 sm:mt-2.5 cursor-pointer"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="mt-6 sm:mt-8 text-sm text-center text-gray-500">
            Remember your password?{' '}
            <Link href="/signin" className="text-[#007185] hover:text-[#c7511f] hover:underline font-bold">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
