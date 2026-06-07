'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[var(--footer-bg)] text-white py-10 px-5 mt-auto hidden md:block">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-7.5 max-w-[1000px] mx-auto pb-10">
        
        {/* Column 1 */}
        <div className="flex flex-col">
          <h3 className="text-base mb-3.75 text-gold-primary tracking-[0.5px] font-bold">Get to Know Us</h3>
          <ul className="list-none p-0 m-0 space-y-3">
            <li>
              <Link href="/about" className="text-[#a0aab5] text-[13px] hover:text-gold-primary transition-colors duration-200">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-[#a0aab5] text-[13px] hover:text-gold-primary transition-colors duration-200">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>
        
        {/* Column 2 */}
        <div className="flex flex-col">
          <h3 className="text-base mb-3.75 text-gold-primary tracking-[0.5px] font-bold">Make Money</h3>
          <ul className="list-none p-0 m-0 space-y-3">
            <li>
              <Link href="/vendor/register" className="text-[#a0aab5] text-[13px] hover:text-gold-primary transition-colors duration-200">
                Sell on MedoxAtoZ
              </Link>
            </li>
          </ul>
        </div>
        
        {/* Column 3 */}
        <div className="flex flex-col">
          <h3 className="text-base mb-3.75 text-gold-primary tracking-[0.5px] font-bold">Help</h3>
          <ul className="list-none p-0 m-0 space-y-3">
            <li>
              <Link href="/account" className="text-[#a0aab5] text-[13px] hover:text-gold-primary transition-colors duration-200">
                Your Account
              </Link>
            </li>
            <li>
              <span className="text-[#a0aab5] text-[13px] hover:text-gold-primary transition-colors duration-200 cursor-pointer">
                Refund and Return Policy
              </span>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Footer Bottom copyright */}
      <div className="text-center border-t border-[#3a4553] pt-7.5 text-[13px] text-[#a0aab5] flex justify-center items-center flex-wrap gap-1.25">
        <span>&copy; 2026, MedoxAtoZ.in, Inc. or its affiliates</span>
      </div>
    </footer>
  );
}
