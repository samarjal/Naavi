import React, { useState } from 'react';
import { INTEREST_CARDS } from '../data/mockData';
import { Compass, CheckCircle } from 'lucide-react';

export default function InterestsSection() {
  const [activeInterest, setActiveInterest] = useState('arch');

  return (
    <section className="py-20 bg-[#152B24] text-white px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column */}
        <div className="lg:col-span-5 space-y-6">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">PERSONALIZED TRAVEL</p>
          <h2 className="text-3xl sm:text-4xl font-serif text-cream-100 font-normal leading-tight">
            Follow an interest, not a checklist.
          </h2>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            Select your passion and let our generator curate spots that match your distinct style, from coffee roasters to architectural landmarks.
          </p>
        </div>

        {/* Right Column Grid */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTEREST_CARDS.map((card) => {
            const isSelected = activeInterest === card.id;

            return (
              <div 
                key={card.id}
                onClick={() => setActiveInterest(card.id)}
                className={`p-6 rounded-3xl cursor-pointer border transition-all duration-300 flex flex-col justify-between space-y-4 ${
                  isSelected 
                    ? 'bg-emerald-900/80 border-emerald-500 text-white shadow-lg' 
                    : 'bg-emerald-950/40 border-emerald-800/60 text-gray-300 hover:bg-emerald-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-800/40 text-emerald-400'}`}>
                    <Compass className="w-4 h-4" />
                  </div>
                  {isSelected && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">{card.title}</h3>
                  <p className="text-xs text-gray-300 mt-2 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}