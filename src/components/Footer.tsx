'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0d1117] text-white mt-auto hidden md:block border-t border-white/5">
      
      {/* Top promo bar */}
      <div className="bg-[#11161d] border-b border-white/5 py-4 px-5">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-10 flex-wrap text-sm text-[#a0aab5]">
          <span className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
            <svg className="w-4 h-4 text-gold-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            Trusted by 10,000+ Clinics
          </span>
          <span className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
            <svg className="w-4 h-4 text-gold-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m0-14v14m-8-4l8 4"/></svg>
            Free Shipping on All Orders
          </span>
          <span className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
            <svg className="w-4 h-4 text-gold-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            100% Genuine Products
          </span>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-5 gap-10 border-b border-white/5">

        {/* Brand Column */}
        <div className="col-span-2">
          <img src="/logo-footer.webp" alt="MedoxAtoZ" className="h-34 object-contain mb-6 drop-shadow-md" />
          <p className="text-[#a0aab5] text-[14px] leading-relaxed mb-6 pr-10">
            India's premier B2B marketplace for premium medical and diagnostic supplies. Engineering the clinical supply chain with clinical precision.
          </p>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 bg-gradient-to-tr from-gold-primary/20 to-transparent border border-gold-primary/40 text-gold-primary hover:bg-gold-primary hover:text-[#0d1117] px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            <Download className="w-4 h-4" /> Get the App
          </Link>

        </div>

        {/* Column: Shop */}
        <div>
          <h3 className="text-xs font-extrabold text-white mb-5 tracking-[0.2em] uppercase">Shop</h3>
          <ul className="space-y-3.5">
            {[
 
              { label: 'Shopping Cart', href: '/cart' },
              { label: 'Secure Checkout', href: '/checkout' },
              { label: 'Download App', href: '/download' },
            ].map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="text-[#a0aab5] text-[14px] hover:text-gold-primary hover:translate-x-1 inline-block transition-all duration-200">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column: Company */}
        <div>
          <h3 className="text-xs font-extrabold text-white mb-5 tracking-[0.2em] uppercase">Company</h3>
          <ul className="space-y-3.5">
            {[
              { label: 'Contact Us', href: 'mailto:medoxatoz@gmail.com' },
              { label: 'Sell on MedoxAtoZ', href: '/vendor/register' },
            ].map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="text-[#a0aab5] text-[14px] hover:text-gold-primary hover:translate-x-1 inline-block transition-all duration-200">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column: Account & Support */}
        <div>
          <h3 className="text-xs font-extrabold text-white mb-5 tracking-[0.2em] uppercase">Account & Support</h3>
          <ul className="space-y-3.5">
            {[
              { label: 'Sign In', href: '/signin' },
              { label: 'Create Account', href: '/signup' },
              { label: 'Your Account', href: '/account' },
              { label: 'Track Orders', href: '/account/orders' },
              { label: 'Saved Wishlist', href: '/account/wishlist' },
            ].map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="text-[#a0aab5] text-[14px] hover:text-gold-primary hover:translate-x-1 inline-block transition-all duration-200">
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Developer Credit */}
          <div className="mt-8 flex flex-col items-start gap-1 text-xs pt-10 text-[#a0aab5]">
            <span className="uppercase tracking-widest text-[10px] font-bold opacity-80">Developed By</span>
            <a 
              href="https://mv-tech-solution.netlify.app/#contact" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center  text-[16px] gap-1.5 py-1 font-black tracking-wide transition-all duration-300 bg-gradient-to-r from-amber-200 via-gold-primary to-amber-500 bg-clip-text text-transparent hover:from-amber-100 hover:via-yellow-400 hover:to-amber-400 hover:drop-shadow-[0_0_12px_rgba(212,175,55,0.8)]"
            >
              MVTechSolutions
            </a>
          </div>
        </div>

      </div>

      {/* Footer Bottom */}
      <div className=" mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-[#a0aab5]">
        <span className="font-medium">© 2026, SREE SAI LAKSHMI GANAPATHI TRADERS (MedoxAtoZ) — All rights reserved.</span>
        <div className="flex items-center gap-5 flex-wrap font-medium">
          <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <span className="opacity-20">|</span>
          <Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
          <span className="opacity-20">|</span>
          <Link href="/refund-policy" className="hover:text-white transition-colors">Return & Refund Policy</Link>
          <span className="opacity-20">|</span>
          <Link href="/shipping-policy" className="hover:text-white transition-colors">Shipping Policy</Link>
        </div>
      </div>

    </footer>
  );
}