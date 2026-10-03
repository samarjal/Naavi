import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, Menu, X } from 'lucide-react';

export default function Navbar({ onOpenModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

        {/* CTA Button */}
        <div className="hidden md:flex items-center">
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