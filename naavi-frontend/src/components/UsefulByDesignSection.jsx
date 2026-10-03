import React from 'react';
import {
  Check,
  ArrowRight,
  Heart,
  Share2,
} from 'lucide-react';

export default function UsefulByDesignSection({ onOpenModal }) {
  const features = [
    'Clear day-by-day structure with sensible pacing',
    'Practical guides for transport, food, timing, and budget',
    'Simple editing when your mood—or the weather—changes',
    'One place to keep the route focused and easy to share',
  ];

  return (
    <section className="w-full bg-[#fdfbf7] py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-[1500px] px-6 sm:px-10 lg:px-14">

        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-14 xl:gap-20">

          {/* =====================================================
              LEFT — ACTUAL ITINERARY IMAGE
          ====================================================== */}
          <div className="relative">

            {/* Image */}
            <div className="relative w-full overflow-hidden rounded-[36px]">
              <img
                src="https://www.itimaker.com/demo-itinerary.jpeg"
                alt="Sample travel itinerary"
                className="
                  block
                  w-full
                  h-auto
                  object-cover
                "
              />
            </div>

            {/* =================================================
                FLOATING INFO CARD
            ================================================== */}
            <div
              className="
                absolute
                z-20
                -bottom-7
                right-5
                sm:right-10
                w-[290px]
                sm:w-[310px]
                rounded-[20px]
                bg-[#f8ead5]
                border border-[#ead9c0]
                shadow-[0_18px_35px_rgba(60,48,35,0.15)]
                px-5
                py-5
              "
            >
              <div className="flex items-start gap-4">

                <div className="mt-0.5 shrink-0 text-[#31766d]">
                  <svg
                    width="27"
                    height="27"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                    <path d="M9 3v15" />
                    <path d="M15 6v15" />
                  </svg>
                </div>

                <div>
                  <h4 className="text-[15px] font-semibold text-[#172f2b]">
                    Built around real travel time
                  </h4>

                  <p className="mt-1 text-[13px] leading-relaxed text-[#777067]">
                    Fewer cross-city sprints. More time actually being there.
                  </p>
                </div>

              </div>
            </div>

            {/* =================================================
                FLOATING ACTION BUTTONS
            ================================================== */}
            <div
              className="
                absolute
                z-30
                -right-4
                sm:-right-6
                bottom-0
                translate-y-[45%]
                flex
                flex-col
                gap-3
              "
            >
              {/* Like */}
              <button
                aria-label="Like"
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  bg-[#638ee9]
                  text-white
                  shadow-[0_5px_15px_rgba(50,70,120,0.22)]
                  transition-transform
                  hover:scale-105
                "
              >
                <Heart className="h-5 w-5" />
              </button>

              {/* Share */}
              <button
                aria-label="Share"
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  bg-white
                  text-[#6385d5]
                  shadow-[0_5px_15px_rgba(50,50,50,0.12)]
                  transition-transform
                  hover:scale-105
                "
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>

          </div>


          {/* =====================================================
              RIGHT — CONTENT
          ====================================================== */}
          <div className="lg:pl-2 xl:pl-4">

            {/* Small heading */}
            <p
              className="
                text-[12px]
                sm:text-[13px]
                font-semibold
                uppercase
                tracking-[0.17em]
                text-[#176b68]
              "
            >
              USEFUL BY DESIGN
            </p>

            {/* Main heading */}
            <h2
              className="
                mt-5
                max-w-[650px]
                font-serif
                font-normal
                tracking-[-0.035em]
                leading-[0.98]
                text-[#1d312e]
                text-[48px]
                sm:text-[54px]
                lg:text-[57px]
                xl:text-[64px]
              "
            >
              A plan you’ll actually
              <br />
              use on the road.
            </h2>

            {/* Description */}
            <p
              className="
                mt-8
                max-w-[650px]
                text-[15px]
                sm:text-[16px]
                leading-[1.75]
                text-[#65635e]
              "
            >
              Every itinerary is structured for quick decisions:
              what to do, when to go, what’s nearby, and where you
              can change course.
            </p>

            {/* =================================================
                FEATURES
            ================================================== */}
            <div className="mt-8 space-y-5">

              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4"
                >

                  {/* Check circle */}
                  <div
                    className="
                      flex
                      h-[25px]
                      w-[25px]
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      bg-[#e7f2ed]
                    "
                  >
                    <Check
                      className="
                        h-[14px]
                        w-[14px]
                        text-[#438c7d]
                        stroke-[2.5]
                      "
                    />
                  </div>

                  <span
                    className="
                      text-[14px]
                      sm:text-[15px]
                      text-[#50514d]
                    "
                  >
                    {feature}
                  </span>

                </div>
              ))}

            </div>

            {/* =================================================
                CTA
            ================================================== */}
            <div className="mt-10">

              <button
                onClick={onOpenModal}
                className="
                  group
                  inline-flex
                  items-center
                  gap-3
                  text-[15px]
                  font-semibold
                  text-[#19716c]
                  transition-colors
                  hover:text-[#10534f]
                "
              >
                <span>
                  See what your trip could look like
                </span>

                <ArrowRight
                  className="
                    h-[18px]
                    w-[18px]
                    transition-transform
                    group-hover:translate-x-1
                  "
                />
              </button>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}