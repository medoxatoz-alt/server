'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Home, Heart, ShoppingBag as LucideShoppingBag, User, Download, Package, X } from 'lucide-react';
import { useState, useEffect, Suspense, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import MegaMenu from '@/components/MegaMenu';
import CartDrawer from '@/components/CartDrawer';
import { useGeolocatedAddress } from '@/hooks/useGeolocatedAddress';

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
      className="order-3 md:order-2 w-full md:w-auto md:flex-1 max-w-full md:max-w-[600px] mt-3 md:mt-0 flex items-center bg-white/5 border border-white/10 backdrop-blur-md rounded-full transition-all duration-300 py-[3px] pr-[5px] pl-5 focus-within:bg-white/10 focus-within:border-gold-primary focus-within:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
    >
      <input 
        type="text" 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search premium medical supplies..."
        className="flex-1 border-none outline-none bg-transparent text-white text-[15px] py-2 w-full focus:text-white placeholder-[#a0aab5]"
        suppressHydrationWarning
      />
      <button 
        type="submit" 
        className="bg-gold-primary border-none rounded-full min-w-[36px] h-[36px] flex items-center justify-center text-nav-bg cursor-pointer transition-all duration-300 ml-2.5 hover:brightness-110 hover:scale-105 hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]"
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
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [location, setLocation] = useState('India');
  const { detect: detectLocationRaw, detecting: loadingLocation } = useGeolocatedAddress({ onError: (msg) => toast.error(msg) });
  const { isInstallable, promptInstall } = usePWAInstall();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLoc = localStorage.getItem('medox_location');
    if (savedLoc) {
      setLocation(savedLoc);
    }
  }, []);

  const detectLocation = async () => {
    try {
      const parsed = await detectLocationRaw();
      const displayLoc = parsed.city ? `${parsed.city}, ${parsed.state}` : parsed.state || 'India';
      localStorage.setItem('medox_location', displayLoc);
      setLocation(displayLoc);
      toast.success(`Location set to ${displayLoc}`);
    } catch {
      // error toast already shown by the hook
    }
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

    const handleOpenCart = () => setIsCartOpen(true);
    
    window.addEventListener('cart-updated', fetchCartCount);
    window.addEventListener('open-cart', handleOpenCart);
    return () => {
      window.removeEventListener('cart-updated', fetchCartCount);
      window.removeEventListener('open-cart', handleOpenCart);
    };
  }, [user]);

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
    setIsDropdownOpen(false);
    router.push('/');
  };

  return (
    <>
      <header className="bg-[#0d1117] border-b border-white/5 sticky top-0 z-[1000] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between py-3 px-3.5 md:px-5 gap-y-3 md:gap-[30px] flex-wrap">
          
          {/* Logo */}
          <div className="order-1">
            <Link href="/" className="flex items-center gap-2 transition-transform duration-300 hover:scale-105">
              <img src="/logo.webp" alt="MedoxAtoZ Logo" className="h-18 md:h-22 w-auto object-contain" />
            </Link>
          </div>
          
          {/* Search Bar */}
          <Suspense fallback={
            <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 max-w-full md:max-w-[600px] mt-3 md:mt-0 flex items-center bg-white/5 border border-white/10 rounded-full py-[3px] pr-[5px] pl-5">
              <input type="text" placeholder="Search premium medical supplies..." className="flex-1 border-none outline-none bg-transparent text-white text-[15px] py-2 w-full placeholder-[#a0aab5]" disabled />
            </div>
          }>
            <SearchBarInput />
          </Suspense>

          {/* Actions */}
          <div className="order-2 flex items-center gap-4 md:gap-6">
            
            <button onClick={detectLocation} disabled={loadingLocation} className="hidden md:flex items-center gap-2 text-white/80 hover:text-gold-primary transition-all duration-300 font-medium bg-transparent border-none cursor-pointer outline-none disabled:opacity-75 group">
              <svg className="w-5 h-5 stroke-current fill-none stroke-2 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span className="text-sm truncate max-w-[120px]">{loadingLocation ? 'Detecting...' : location}</span>
            </button>

            {/* Account Dropdown (Simplified for brevity, keep your original dropdown logic here) */}
            <div className="relative flex items-center md:pb-[25px] md:mb-[-25px] group" ref={dropdownRef}>
              <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 text-white hover:text-gold-primary transition-all duration-300 font-medium cursor-pointer bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:border-gold-primary/30 hover:bg-white/10">
                <User className="w-4 h-4" />
                <span className="text-sm hidden md:inline">
                  {!loading && user && user.name ? `${user.name.split(' ')[0]} ▾` : 'Sign In ▾'}
                </span>
              </div>
              {/* Two-column Dropdown Panel */}
              <div className={`
              ${isDropdownOpen ? 'flex' : 'hidden'} md:group-hover:flex 
              flex-col 
              fixed inset-0 bg-white z-[3000] overflow-y-auto
              md:absolute md:inset-auto md:top-full md:right-[-60px] md:bg-white 
              text-text-main 
              w-full md:w-[450px] rounded-none md:rounded-lg 
              shadow-none md:shadow-[0_8px_25px_rgba(0,0,0,0.15)] 
              border-none md:border md:border-[#e1e4e8] 
              p-5 md:p-6 cursor-default mt-0 
              transition-all duration-300 
              md:before:content-[''] md:before:absolute md:before:top-[-7px] 
              md:before:right-[80px] md:before:w-3 md:before:h-3 md:before:bg-white 
              md:before:rotate-45 md:before:border-t md:before:border-l md:before:border-[#e1e4e8]
            `}>
                {/* Mobile Header */}
                <div className="md:hidden pt-4 flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                  <div className="font-bold text-lg text-gray-900">Your Account</div>
                  <button onClick={() => setIsDropdownOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

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
                        <Link href="/account/orders" onClick={() => setIsDropdownOpen(false)} className="block py-1 text-[#555] hover:text-gold-primary hover:underline hover:pl-1 transition-all duration-300 text-[13px] text-left w-full">
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
                        {isInstallable && (
                          <>
                            <div className="font-bold mb-2 mt-4 text-[15px] text-black">Get the App</div>
                            <ul className="list-none p-0 m-0 space-y-1">
                              <li>
                                <button
                                  onClick={() => { promptInstall(); setIsDropdownOpen(false); }}
                                  className="flex items-center gap-1.5 py-1 text-[#007185] hover:text-gold-primary hover:underline transition-all duration-300 text-[13px] font-semibold bg-transparent border-none cursor-pointer text-left w-full"
                                >
                                  <Download className="w-3.5 h-3.5" /> Install App
                                </button>
                              </li>
                            </ul>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* UPGRADED: Download App Button */}
            <Link 
              href="/download" 
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-sky-400/40 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)] transition-all duration-300 text-white hover:text-sky-400 group"
            >
              <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-300" />
              <span className="text-sm font-semibold tracking-wide">App</span>
            </Link>

            {/* UPGRADED: Orders Button */}
            <Link 
              href="/account" 
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-gold-primary/40 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] transition-all duration-300 text-white hover:text-gold-primary group"
            >
              <Package className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
              <span className="text-sm font-semibold tracking-wide">Orders</span>
            </Link>

            {/* UPGRADED: Cart Button */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative hidden md:flex items-center gap-2 bg-gradient-to-tr from-gold-primary/20 to-transparent py-2 px-5 rounded-full border border-gold-primary/40 text-gold-primary hover:bg-gold-primary hover:text-[#0d1117] transition-all duration-500 shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] group cursor-pointer"
            >
              <LucideShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              {cartCount > 0 && (
                <span className="bg-white text-[#0d1117] font-extrabold text-[11px] h-[20px] min-w-[20px] rounded-full flex items-center justify-center px-1 absolute -top-1.5 -right-1.5 z-[2] shadow-[0_2px_5px_rgba(0,0,0,0.2)] animate-pulse">
                  {cartCount}
                </span>
              )}
              <span className="text-sm font-bold tracking-wide">Cart</span>
            </button>
          </div>
        </div>
        {/* Categories Mega Menu */}
        {(pathname === '/' || pathname?.startsWith('/categories')) && <MegaMenu />}
      </header>

      {/* UPGRADED: Mobile Sticky Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] z-[999] flex justify-around items-end h-[72px] pb-3 px-2">
        
        <Link href="/" className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/' ? 'text-gold-primary -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <Home className={`w-6 h-6 stroke-[1.5px] ${pathname === '/' ? 'fill-gold-primary/10 stroke-2' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-wide">Home</span>
        </Link>

        <Link href="/account/wishlist" className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/account/wishlist' ? 'text-gold-primary -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <Heart className={`w-6 h-6 stroke-[1.5px] ${pathname === '/account/wishlist' ? 'fill-gold-primary/10 stroke-2' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-wide">Wishlist</span>
        </Link>

        {/* Floating Action Button (FAB) for Cart on Mobile */}
        <div className="flex-1 flex justify-center relative h-full">
          <button onClick={() => setIsCartOpen(true)} className="absolute -top-6 flex flex-col items-center justify-center transition-transform duration-300 active:scale-95 group cursor-pointer border-none bg-transparent">
            <div className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-[0_8px_20px_rgba(212,175,55,0.3)] border-[3px] border-white transition-colors duration-300 ${isCartOpen ? 'bg-gold-primary text-white' : 'bg-[#0d1117] text-gold-primary'}`}>
              <LucideShoppingBag className="w-6 h-6 stroke-2 group-hover:scale-110 transition-transform" />
              {cartCount > 0 && (
                <span className="bg-red-500 text-white font-extrabold text-[10px] h-[18px] min-w-[18px] rounded-full inline-flex items-center justify-center px-1 border-2 border-white absolute -top-1 -right-1 z-[2]">
                  {cartCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-bold mt-1.5 tracking-wide ${isCartOpen ? 'text-gold-primary' : 'text-gray-400'}`}>Cart</span>
          </button>
        </div>

        <Link href="/account/orders" className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname?.startsWith('/account/orders') ? 'text-gold-primary -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <Package className={`w-6 h-6 stroke-[1.5px] ${pathname?.startsWith('/account/orders') ? 'fill-gold-primary/10 stroke-2' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-wide">Orders</span>
        </Link>

        <Link href="/account" className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${pathname === '/account' ? 'text-gold-primary -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <User className={`w-6 h-6 stroke-[1.5px] ${pathname === '/account' ? 'fill-gold-primary/10 stroke-2' : ''}`} />
          <span className="text-[10px] font-bold mt-1 tracking-wide">Account</span>
        </Link>
        
      </div>
      
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}