import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Sparkles, Menu, X, UserCircle2, LogOut } from 'lucide-react';

export default function Navbar({ onOpenModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);

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

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('storage', readUser);
    readUser();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', readUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('naaviToken');
    localStorage.removeItem('naaviUser');
    setUser(null);
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
          {user ? (
            <>
              <Link to="/profile" className="flex items-center gap-2 rounded-full border border-[#D8E8E2] bg-[#F5F9F7] px-3 py-2 text-sm font-medium text-[#1F2C28]">
                <UserCircle2 className="h-4 w-4 text-[#3A7563]" />
                <span style={{ maxWidth: '140px' }} className="truncate">{user.name || 'Traveler'}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isScrolled
                    ? 'border-[#D7D2C9] text-[#152B24] hover:bg-[#F4EFE9]'
                    : 'border-white/15 text-white hover:bg-white/10'
                }`}
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </>
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
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden">
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
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-full border border-[#D8E8E2] bg-[#F5F9F7] px-4 py-3 text-sm font-medium text-[#1F2C28]">
                <UserCircle2 className="h-4 w-4 text-[#3A7563]" />
                <span style={{ maxWidth: '140px' }} className="truncate">{user.name || 'Traveler'}</span>
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

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenModal?.();
            }}
            className="w-full bg-[#E1A374] text-[#1A231F] py-3 rounded-full flex items-center justify-center gap-2 text-sm"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Build my itinerary</span>
          </button>
        </div>
      )}
    </nav>
  );
}