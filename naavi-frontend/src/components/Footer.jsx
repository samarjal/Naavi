import React from 'react';
import { Compass, Mail, Globe, MessageCircle, Link } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#152B24] text-white pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-t border-emerald-900/60">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-emerald-300">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-xl font-serif font-bold text-cream-100">ItiMaker</span>
            </div>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Practical day-by-day plans, destination intelligence, and room for the discoveries that make a trip yours.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors">
              <Mail className="w-4 h-4 text-emerald-400" />
              <a href="mailto:support@itimaker.com">support@itimaker.com</a>
            </div>
          </div>

          {/* Links Grid */}
          <div className="md:col-span-7 grid grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">PLAN</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li><a href="#explore" className="hover:text-white transition-colors">AI itinerary maker</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
                <li><a href="#destinations" className="hover:text-white transition-colors">Travel guides</a></li>
                <li><a href="#destinations" className="hover:text-white transition-colors">Popular destinations</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">ABOUT</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li><a href="#about" className="hover:text-white transition-colors">Our story</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Methodology</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Editorial policy</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">LEGAL</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
                <li><a href="#" className="hover:text-white transition-colors">RSS feed</a></li>
              </ul>
            </div>
          </div>

        </div>

        {/* Bottom Social Bar */}
        <div className="pt-8 border-t border-emerald-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© 2026 ItiMaker. Made for curious travelers.</p>
          <div className="flex items-center space-x-3">
            <button className="w-8 h-8 rounded-full bg-emerald-900/60 hover:bg-emerald-800 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
              <Globe className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-full bg-emerald-900/60 hover:bg-emerald-800 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-full bg-emerald-900/60 hover:bg-emerald-800 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
              <Link className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}