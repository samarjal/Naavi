import React from "react";
import {
  ArrowRight,
  Sparkles,
  Compass,
  SlidersHorizontal,
  CalendarDays,
} from "lucide-react";

export default function PhilosophySection({ onOpenModal }) {
  const points = [
    {
      num: "01",
      icon: Compass,
      title: "Share the shape of your trip",
      desc: "Destination, dates, travel style, pace, and the things you never want to miss.",
    },
    {
      num: "02",
      icon: SlidersHorizontal,
      title: "Get a sensible day-by-day route",
      desc: "We group nearby experiences and account for realistic travel time between stops.",
    },
    {
      num: "03",
      icon: CalendarDays,
      title: "Make every detail yours",
      desc: "Swap activities, slow a day down, and keep refining until the itinerary feels right.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-[#EEF4F1] px-6 py-[76px] sm:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1200px]">

        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="mx-auto max-w-[720px] text-center">

          {/* Small eyebrow */}
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#347D72]">
            FROM IDEA TO ITINERARY
          </p>

          {/* Heading */}
          <h2 className="font-serif text-[45px] font-normal leading-[0.98] tracking-[-0.035em] text-[#203A35] sm:text-[52px] lg:text-[56px]">
            Good planning should feel
            <br />
            light.
          </h2>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-[680px] text-[15px] leading-[1.65] text-[#4D6A64] sm:text-[16px]">
            Naavi turns a loose travel idea into a clear route, while
            leaving you in control of every
            <br className="hidden sm:block" />
            choice.
          </p>
        </div>

        {/* =====================================================
            FEATURE CARDS
        ====================================================== */}
        <div className="relative mt-[60px]">

          {/* Desktop connector line */}
          <div className="pointer-events-none absolute left-[32.8%] right-[32.8%] top-[39px] hidden h-px border-t border-dashed border-[#AFC7C0] lg:block" />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-5">
            {points.map((point) => {
              const Icon = point.icon;

              return (
                <div
                  key={point.num}
                  className="
                    relative
                    z-10
                    min-h-[234px]
                    rounded-[25px]
                    border
                    border-[#E6E2DC]
                    bg-[#FFFCF9]
                    px-7
                    py-7
                    shadow-[0_18px_40px_rgba(38,67,59,0.06)]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:shadow-[0_22px_45px_rgba(38,67,59,0.10)]
                  "
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between">

                    {/* Icon */}
                    <div
                      className="
                        flex
                        h-[56px]
                        w-[56px]
                        items-center
                        justify-center
                        rounded-[16px]
                        bg-[#E1EEEA]
                        text-[#43877B]
                      "
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
                    </div>

                    {/* Number */}
                    <span className="font-serif text-[25px] font-normal text-[#E89A68]">
                      {point.num}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="mt-[34px]">
                    <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[#172F2A]">
                      {point.title}
                    </h3>

                    <p className="mt-3 max-w-[330px] text-[14px] leading-[1.65] text-[#617772]">
                      {point.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =====================================================
            CTA
        ====================================================== */}
        <div className="mt-[40px] flex justify-center">
          <button
            onClick={onOpenModal}
            className="
              group
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-[#1D3832]
              px-[23px]
              py-[15px]
              text-[13px]
              font-semibold
              text-white
              shadow-[0_12px_25px_rgba(29,56,50,0.15)]
              transition-all
              duration-200
              hover:bg-[#27483F]
              hover:shadow-[0_15px_30px_rgba(29,56,50,0.22)]
            "
          >
            <Sparkles
              className="h-[15px] w-[15px]"
              strokeWidth={1.8}
            />

            <span>Build my itinerary</span>

            <ArrowRight
              className="h-[15px] w-[15px] transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={1.8}
            />
          </button>
        </div>
      </div>
    </section>
  );
}