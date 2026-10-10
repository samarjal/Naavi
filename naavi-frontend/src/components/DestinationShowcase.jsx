import { ArrowUpRight } from 'lucide-react'
import { destinations } from '../data'

export default function Destinations() {
  return (
    <section className="bg-cream py-16">
      <div className="container-x">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Start with a place</p>
            <h2 className="h-serif mt-3 max-w-md text-4xl sm:text-[42px]">
              Where will your curiosity take you?
            </h2>
          </div>
          <a
            href="#"
            className="hidden items-center gap-1 text-[11px] font-bold text-forest sm:flex"
          >
            Explore every destination
            <ArrowUpRight size={12} />
          </a>
        </div>

        {/* Updated CSS Grid layout */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {destinations.map((d, index) => {
            // Check if the current item is one of the last two items in the showcase
            const isLastTwo = index >= destinations.length - 2;

            return (
              <a
                key={d.name}
                href="#"
                className={`group relative flex items-end overflow-hidden rounded-2xl bg-forest ${
                  isLastTwo ? 'sm:col-span-2 min-h-55' : d.cls || 'min-h-55'
                }`}
              >
                <img
                  src={d.img}
                  alt={d.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                <div className="relative p-4 text-white">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-white/80">
                    {d.country}
                  </p>
                  <p className="font-serif text-xl">{d.name}</p>
                  <p className="text-[10px] text-white/75">{d.tag}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}