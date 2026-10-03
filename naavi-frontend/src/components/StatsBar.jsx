import React from 'react';

export default function StatsBar() {
  const stats = [
    { value: '10,000+', label: 'ITINERARIES GENERATED' },
    { value: '75+', label: 'COUNTRIES COVERED' },
    { value: '24/7', label: 'AI ASSISTANCE' },
    { value: '100%', label: 'PERSONALISED' },
  ];

  return (
    <section className="bg-[#FAF0E6] border-y border-amber-200/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {stats.map((stat, idx) => (
          <div key={idx} className="space-y-1">
            <p className="text-2xl sm:text-3xl font-serif font-bold text-forest-900">{stat.value}</p>
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}