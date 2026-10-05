import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Sparkles, Menu, X, UserCircle2, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar({ onOpenModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    const readUser = () => {
      try {
        const storedUser = localStorage.getItem('naaviUser');
        setUser(storedUser ? JSON.parse(storedUser) : null);
      } catch (error) {
        setUser(null);
      }
    };

    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('storage', readUser);
    document.addEventListener('mousedown', handleOutsideClick);
    readUser();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', readUser);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('naaviToken');
    localStorage.removeItem('naaviUser');
    setUser(null);
    setProfileOpen(false);
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        isScrolled
          ? 'bg-[#F8F6F2] text-[#2C3A33] border-b border-[#E3DFD7]'
          : 'bg-[#152B24] text-white border-b border-emerald-900/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isScrolled
                ? 'bg-[#E6F2ED] text-[#3A7563]'
                : 'bg-[#f79041] text-white border border-emerald-700/60'
            }`}
          >
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-xl font-semibold tracking-tight font-sans transition-colors ${
              isScrolled ? 'text-[#2C3A33]' : 'text-cream-100'
            }`}
          >
            Naavi
          </span>
        </div>

        {/* Links */}
        <div
          className={`hidden md:flex items-center space-x-10 text-sm font-normal transition-colors ${
            isScrolled ? 'text-[#2C3A33]' : 'text-gray-300'
          }`}
        >
          <a href="#plan" className="hover:opacity-80 transition-opacity">Plan a trip</a>
          <a href="#guides" className="hover:opacity-80 transition-opacity">Travel guides</a>
          <a href="#destinations" className="hover:opacity-80 transition-opacity">Destinations</a>
          <a href="#how-it-works" className="hover:opacity-80 transition-opacity">How it works</a>
        </div>

        {/* Auth and CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onOpenModal}
            className={`font-normal px-6 py-2.5 rounded-full text-sm transition-all flex items-center gap-2 ${
              isScrolled
                ? 'bg-[#f79041] text-[#1A231F] hover:bg-[#D89767]'
                : 'bg-[#f79041] text-white hover:bg-coral-600'
            }`}
          >
            <Sparkles className="w-4 h-4 fill-current stroke-[1.5]" />
            <span>Build my itinerary</span>
          </button>

          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((previous) => !previous)}
                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                  isScrolled
                    ? 'border-[#D7D2C9] bg-white text-[#152B24] hover:bg-[#F4EFE9]'
                    : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                <UserCircle2 className="h-5 w-5 text-[#3A7563]" />
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-[#E3DFD7] bg-white shadow-[0_20px_50px_rgba(21,43,36,0.14)]">
                  <div className="border-b border-[#EFE6DC] px-4 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5A6F68]">Profile</p>
                    <p className="mt-2 text-base font-semibold text-[#152B24]">{user?.name || 'Traveler'}</p>
                    <p className="mt-1 text-sm text-[#5A6F68]">{user?.email || 'No email available'}</p>
                    {user?.phone && <p className="mt-1 text-sm text-[#5A6F68]">{user.phone}</p>}
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#152B24] hover:bg-[#F8F5F1]"
                  >
                    <UserCircle2 className="h-4 w-4 text-[#3A7563]" />
                    View profile
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 border-t border-[#EFE6DC] px-4 py-3 text-left text-sm font-medium text-[#7A2B2B] hover:bg-[#FFF5F3]"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isScrolled ? 'text-[#152B24] hover:text-[#0F201E]' : 'text-white hover:text-[#F5EDE7]'
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-[#f79041] px-4 py-2 text-sm font-semibold text-[#1A231F] transition hover:bg-[#E78339]"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden relative">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 ${isScrolled ? 'text-[#2C3A33]' : 'text-gray-300'}`}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden px-6 pt-3 pb-6 space-y-4 border-b ${
            isScrolled
              ? 'bg-[#F8F6F2] text-[#2C3A33] border-[#E3DFD7]'
              : 'bg-[#152B24] text-gray-200 border-emerald-900'
          }`}
        >
          <a href="#plan" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">Plan a trip</a>
          <a href="#guides" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">Travel guides</a>
          <a href="#destinations" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">Destinations</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">How it works</a>

          {user ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenModal?.();
                }}
                className="w-full rounded-full bg-[#f79041] px-4 py-3 text-sm font-semibold text-[#1A231F]"
              >
                Build my itinerary
              </button>

              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-3xl border border-[#D8E8E2] bg-white px-4 py-4 text-[#1F2C28]"
              >
                <UserCircle2 className="h-7 w-7 text-[#3A7563]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user.name || 'Traveler'}</p>
                  <p className="text-xs text-[#5A6F68] truncate">{user.email || 'View profile'}</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full rounded-full border border-[#D7D2C9] bg-transparent px-4 py-3 text-sm text-[#1F2C28]"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block rounded-full border border-[#D7D2C9] bg-transparent px-4 py-3 text-sm text-center text-[#1F2C28]">
                Login
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="block rounded-full bg-[#f79041] px-4 py-3 text-sm font-semibold text-center text-[#1A231F]">
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}