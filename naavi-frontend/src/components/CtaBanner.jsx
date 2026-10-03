import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function CtaBanner({ onOpenModal }) {
  return (
    <section className="bg-[#152B24] pt-12 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-[#FAF0E6] rounded-[36px] p-8 sm:p-14 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-xl">
          
          {/* Top-Right Decorative Shapes */}
          <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-[#F4DCD0]/60" />
          </div>

          {/* Banner Text */}
          <div className="space-y-4 max-w-xl relative z-10">
            <p className="text-xs font-bold text-[#152B24] uppercase tracking-widest">READY WHEN YOU ARE</p>
            <h2 className="text-3xl sm:text-4xl font-serif text-forest-900 font-normal leading-tight">
              A thoughtful itinerary, without the planning spiral.
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Tell us where you’re going and how you like to travel. We’ll shape the days; you keep the final say.
            </p>
          </div>

          {/* Banner Action Button */}
          <div className="relative z-10 shrink-0">
            <button 
              onClick={onOpenModal}
              className="bg-[#152B24] hover:bg-forest-800 text-white font-medium px-8 py-4 rounded-full text-sm transition-all shadow-lg hover:shadow-xl flex items-center gap-3"
            >
              <span>Plan my trip</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}