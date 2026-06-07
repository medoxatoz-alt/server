'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Home, Heart, ShoppingBag as LucideShoppingBag, User } from 'lucide-react';
import { useState, useEffect, Suspense, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function SearchBarInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/');
    }
  };

  return (
    <form 
      onSubmit={handleSearch} 
      // Added w-full for mobile to force it to take the full width of the bottom row
      className="order-3 md:order-2 w-full md:w-auto md:flex-1 max-w-full md:max-w-[600px] mt-3 md:mt-0 flex items-center bg-white/10 border border-white/20 rounded-full transition-all duration-300 py-[3px] pr-[5px] pl-5 focus-within:bg-white focus-within:border-gold-primary focus-within:shadow-[0_0_0_4px_rgba(212,175,55,0.2)]"
    >
      <input 
        type="text" 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search premium medical supplies..."
        className="flex-1 border-none outline-none bg-transparent text-white text-[15px] py-2 w-full focus:text-text-main placeholder-[#a0aab5]"
        suppressHydrationWarning
      />
      <button 
        type="submit" 
        className="bg-gold-primary border-none rounded-full min-w-[36px] h-[36px] flex items-center justify-center text-white cursor-pointer transition-all duration-300 ml-2.5 hover:brightness-110 hover:scale-105"
        suppressHydrationWarning
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
    </form>
  );
}

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [location, setLocation] = useState('India');
  const [loadingLocation, setLoadingLocation] = useState(false);
  
  // Mobile dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLoc = localStorage.getItem('medox_location');
    if (savedLoc) {
      setLocation(savedLoc);
    }
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const address = data.address || {};
          const city = address.city || address.town || address.village || address.suburb || address.county || '';
          const state = address.state || '';
          const displayLoc = city ? `${city}, ${state}` : state || 'India';
          
          localStorage.setItem('medox_location', displayLoc);
          setLocation(displayLoc);
          toast.success(`Location set to ${displayLoc}`);
        } catch {
          toast.error('Failed to detect location.');
        } finally {
          setLoadingLocation(false);
        }
      },
      () => {
        toast.error('Location access denied or unavailable.');
        setLoadingLocation(false);
      }
    );
  };

  useEffect(() => {
    const fetchCartCount = () => {
      if (user) {
        api.get('/cart')
          .then(res => {
            const totalItems = res.data.reduce((acc: number, item: any) => acc + item.quantity, 0);
            setCartCount(totalItems);
          })
          .catch(err => console.error("Failed to fetch cart count", err));
      } else {
        setCartCount(0);
      }
    };

    fetchCartCount();

    window.addEventListener('cart-updated', fetchCartCount);
    return () => window.removeEventListener('cart-updated', fetchCartCount);
  }, [user]);

  // Handle clicking outside to close mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false); // Close menu on logout
    router.push('/');
  };

  return (
    <>
      <header className="bg-nav-bg border-b-2 border-gold-primary sticky top-0 z-[1000] shadow-[0_4px_15px_rgba(0,0,0,0.1)]">
      <div className="max-w-[1500px] mx-auto flex items-center justify-between py-3 px-3.5 md:px-5 gap-y-3 md:gap-[30px] flex-wrap">
        
        {/* Logo */}
        <div className="order-1">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.webp" alt="MedoxAtoZ Logo" className="h-18  md:h-20 w-auto object-contain" />
          </Link>
        </div>
        
        {/* Search Bar with Suspense Boundary */}
        <Suspense fallback={
          <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 max-w-full md:max-w-[600px] mt-3 md:mt-0 flex items-center bg-white/10 border border-white/20 rounded-full py-[3px] pr-[5px] pl-5">
            <input 
              type="text" 
              placeholder="Search premium medical supplies..."
              className="flex-1 border-none outline-none bg-transparent text-white text-[15px] py-2 w-full placeholder-[#a0aab5]"
              disabled
            />
            <button className="bg-gold-primary border-none rounded-full min-w-[36px] h-[36px] flex items-center justify-center text-white ml-2.5 opacity-70" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        }>
          <SearchBarInput />
        </Suspense>

        {/* Actions */}
        <div className="order-2 flex items-center gap-3.5 md:gap-[25px]">
          
          {/* Location Info */}
          <button
            onClick={detectLocation}
            disabled={loadingLocation}
            className="hidden md:flex items-center gap-2 text-white hover:text-gold-primary transition-all duration-300 font-medium bg-transparent border-none cursor-pointer outline-none disabled:opacity-75"
            title="Click to detect current location"
          >
            <svg className="w-5 h-5 stroke-current fill-none stroke-2 flex-shrink-0" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span className="text-sm truncate max-w-[120px]">{loadingLocation ? 'Detecting...' : location}</span>
          </button>

          {/* User Account Dropdown */}
          <div className="relative flex items-center md:pb-[25px] md:mb-[-25px] group" ref={dropdownRef}>
            <div 
              className="flex items-center gap-2 text-white hover:text-gold-primary transition-all duration-300 font-medium cursor-pointer"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <svg className="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="text-sm hidden md:inline">
                {!loading && user && user.name ? `${user.name.split(' ')[0]} ▾` : 'Sign In ▾'}
              </span>
            </div>

            {/* Two-column Dropdown Panel */}
            <div className={`
              ${isDropdownOpen ? 'flex' : 'hidden'} md:group-hover:flex 
              flex-col absolute top-full right-0 md:right-[-60px] bg-white text-text-main 
              w-[280px] sm:w-[320px] md:w-[450px] rounded-lg shadow-[0_8px_25px_rgba(0,0,0,0.15)] 
              border border-[#e1e4e8] z-[2000] p-4 md:p-6 cursor-default mt-2 md:mt-0 
              transition-all duration-300 before:content-[''] before:absolute before:top-[-7px] 
              before:right-[10px] md:before:right-[80px] before:w-3 before:h-3 before:bg-white 
              before:rotate-45 before:border-t before:before:border-l before:border-l before:border-[#e1e4e8]
            `}>
              
              {!loading && !user && (
                <>
                  <Link 
                    href="/signin" 
                    onClick={() => setIsDropdownOpen(false)}
                    className="bg-gradient-to-br from-[#e4c563] to-[#d4af37] text-[#111111] border-none block text-center py-3 px-5 rounded-full font-bold text-[15px] cursor-pointer shadow-[0_4px_10px_rgba(212,175,55,0.3)] mb-4 transition-all duration-300 hover:from-[#ecd17d] hover:to-[#c5a02e] hover:-translate-y-0.5 hover:shadow-[0_6px_15px_rgba(212,175,55,0.45)]"
                  >
                    Sign in
                  </Link>
                  <div className="text-center text-[13px] mb-3 text-[#333]">
                    New customer?{' '}
                    <Link href="/signup" onClick={() => setIsDropdownOpen(false)} className="text-[#007185] hover:text-[#c7511f] hover:underline font-semibold">
                      Start here.
                    </Link>
                  </div>
                </>
              )}
              
              <div className="flex flex-col md:flex-row gap-4 md:gap-5 mt-2 md:mt-4 border-t border-gray-100 pt-4 md:pt-5" style={!user ? {} : { marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
                {/* Lists Column */}
                <div className="flex-1">
                  <div className="font-bold mb-2 md:mb-3 text-[15px] text-black">Your Lists</div>
                  <ul className="list-none p-0 m-0 space-y-2 md:space-y-1">
                    <li>
                      <Link href="/account/wishlist" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#555] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] text-left w-full">
                        Create a Wish List
                      </Link>
                    </li>
                    <li>
                      <Link href="/account" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#555] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] text-left w-full">
                        Saved Items
                      </Link>
                    </li>
                  </ul>
                </div>
                
                {/* Accounts Column */}
                <div className="flex-1 md:border-l md:border-gray-100 md:pl-5 mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                  <div className="font-bold mb-2 md:mb-3 text-[15px] text-black">Your Account</div>
                  <ul className="list-none p-0 m-0 space-y-2 md:space-y-1">
                    <li>
                      <Link href="/account" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#555] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] text-left w-full">
                        Your Account
                      </Link>
                    </li>
                    <li>
                      <Link href="/account" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#555] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] text-left w-full">
                        Your Orders
                      </Link>
                    </li>
                    {user?.role === 'admin' && (
                      <li className="mt-3 md:mt-4 border-t border-gray-100 pt-3 md:pt-4">
                        <Link href="/admin" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#007185] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] font-bold text-left w-full">
                          Admin Dashboard
                        </Link>
                      </li>
                    )}
                    {user?.role === 'vendor' && (
                      <li className="mt-3 md:mt-4 border-t border-gray-100 pt-3 md:pt-4">
                        <Link href="/vendor/dashboard" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#28a745] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] font-bold text-left w-full">
                          Seller Dashboard
                        </Link>
                      </li>
                    )}
                    {user && (
                      <li className="mt-3 md:mt-4 border-t border-gray-100 pt-3 md:pt-4">
                        <button 
                          onClick={handleLogout} 
                          className="block py-1 text-[#d9534f] hover:text-red-700 hover:underline hover:pl-1 transition-all duration-300 text-[13px] font-semibold bg-transparent border-none cursor-pointer text-left w-full"
                        >
                          Sign Out
                        </button>
                      </li>
                    )}
                  </ul>
                  
                  {!user || user.role === 'buyer' ? (
                    <>
                      <div className="font-bold mb-2 md:mb-3 text-[15px] text-black mt-4 md:mt-6">Sellers</div>
                      <ul className="list-none p-0 m-0 space-y-1">
                        <li>
                          <Link href="/vendor/register" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#555] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] text-left w-full">
                            Register as a Seller
                          </Link>
                        </li>
                      </ul>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Orders Link */}
          <Link href="/account" className="hidden md:flex items-center gap-2 text-white hover:text-gold-primary transition-all duration-300 font-medium cursor-pointer">
            <svg className="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span className="text-sm">Orders</span>
          </Link>

          {/* Cart Button */}
          <Link href="/cart" className="relative flex items-center gap-2 bg-gold-primary/10 py-2 px-[18px] rounded-full border border-gold-primary/30 text-gold-primary hover:bg-gold-primary hover:text-nav-bg transition-all duration-300">
            <svg className="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {cartCount > 0 && (
              <span className="bg-gold-primary text-nav-bg font-extrabold text-[11px] h-[18px] min-w-[18px] rounded-full inline-flex items-center justify-center px-1 border-2 border-nav-bg absolute -top-1.5 right-1 z-[2]">
                {cartCount}
              </span>
            )}
            <span className="text-sm hidden md:inline font-bold">Cart</span>
          </Link>
        </div>
      </div>
    </header>

    {/* Mobile Sticky Bottom Tab Bar */}
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200/60 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-[999] flex justify-around items-center h-16 pb-safe">
      {/* Home Tab */}
      <Link 
        href="/" 
        className={`flex flex-col items-center justify-center flex-1 h-full active:scale-[0.92] transition-transform duration-150 ${
          pathname === '/' ? 'text-gold-primary' : 'text-gray-400'
        }`}
      >
        <Home className="w-5.5 h-5.5 stroke-2" />
        <span className="text-[10px] font-bold mt-1 tracking-wide">Home</span>
      </Link>

      {/* Wishlist Tab */}
      <Link 
        href="/account/wishlist" 
        className={`flex flex-col items-center justify-center flex-1 h-full active:scale-[0.92] transition-transform duration-150 ${
          pathname === '/account/wishlist' ? 'text-gold-primary' : 'text-gray-400'
        }`}
      >
        <Heart className="w-5.5 h-5.5 stroke-2" />
        <span className="text-[10px] font-bold mt-1 tracking-wide">Wishlist</span>
      </Link>

      {/* Cart Tab */}
      <Link 
        href="/cart" 
        className={`flex flex-col items-center justify-center flex-1 h-full active:scale-[0.92] transition-transform duration-150 relative ${
          pathname === '/cart' ? 'text-gold-primary' : 'text-gray-400'
        }`}
      >
        <div className="relative">
          <LucideShoppingBag className="w-5.5 h-5.5 stroke-2" />
          {cartCount > 0 && (
            <span className="bg-gold-primary text-nav-bg font-extrabold text-[9px] h-4 min-w-[16px] rounded-full inline-flex items-center justify-center px-1 border border-white absolute -top-1.5 -right-1.5 z-[2]">
              {cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold mt-1 tracking-wide">Cart</span>
      </Link>

      {/* Account Tab */}
      <Link 
        href="/account" 
        className={`flex flex-col items-center justify-center flex-1 h-full active:scale-[0.92] transition-transform duration-150 ${
          pathname?.startsWith('/account') && pathname !== '/account/wishlist' ? 'text-gold-primary' : 'text-gray-400'
        }`}
      >
        <User className="w-5.5 h-5.5 stroke-2" />
        <span className="text-[10px] font-bold mt-1 tracking-wide">Account</span>
      </Link>
    </div>
    </>
  );
}