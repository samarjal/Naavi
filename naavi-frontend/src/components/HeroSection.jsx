import React from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  ArrowRight,
  Sparkles,
  Clock,
  Compass,
  Check,
  Heart,
  Share2,
} from "lucide-react";

export default function HeroSection({
  searchInput,
  setSearchInput,
  onOpenModal,
}) {
  const destinations = ["Paris", "Tokyo", "Rome", "Bangkok", "New York"];

  return (
    <section className="relative min-h-[780px] overflow-hidden bg-[#1B302A] text-white">
      {/* =========================================================
          BACKGROUND
      ========================================================== */}

      {/* Background city image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?auto=format&fit=crop&w=2200&q=85')",
        }}
      />

      {/* Dark green overlay */}
      <div className="absolute inset-0 bg-[#142A24]/90" />

      {/* Green atmospheric gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#172E27] via-[#1B302A]/90 to-[#263B35]/75" />

      <div className="absolute -top-40 -left-40 h-[650px] w-[650px] rounded-full bg-[#24483D]/35 blur-[130px]" />

      <div className="absolute -bottom-48 right-0 h-[600px] w-[700px] rounded-full bg-[#5A7168]/20 blur-[150px]" />

      {/* =========================================================
          CONTENT
      ========================================================== */}

      <div className="relative z-10 mx-auto flex min-h-[780px] max-w-[1600px] items-center px-8 py-16 sm:px-12 lg:px-[5.2%]">
        <div className="grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-[0.95fr_1.05fr]">

          {/* =====================================================
              LEFT SIDE
          ====================================================== */}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="max-w-[690px]"
          >
            {/* Top badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-[15px] w-[15px] text-[#D9E4DF]" />

              <span className="text-[12px] font-semibold tracking-[0.12em] text-[#C9D8D2]">
                PLAN LESS. EXPERIENCE MORE.
              </span>
            </div>

            {/* Heading */}
            <h1 className="max-w-[610px] font-serif text-[58px] leading-[0.96] tracking-[-0.035em] text-[#FBF9F5] sm:text-[68px] lg:text-[76px] xl:text-[82px]">
              Your trip,
              <br />
              thoughtfully
              <br />
              mapped.
            </h1>

            {/* Description */}
            <p className="mt-9 max-w-[650px] text-[16px] leading-[1.65] text-[#CBD4D0] sm:text-[18px]">
              Build a personal day-by-day itinerary from thousands of
              practical destination guides—then tune the pace, budget, and
              details to fit you.
            </p>

            {/* Search */}
            <div className="mt-12">
              <p className="mb-3 text-[14px] font-medium text-[#D4DCD8]">
                Where are you dreaming of?
              </p>

              <div className="flex w-full max-w-[650px] items-center rounded-full bg-[#FCFBF9] p-[7px] shadow-[0_15px_45px_rgba(0,0,0,0.18)]">
                {/* Input */}
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-5">
                  <MapPin className="h-[18px] w-[18px] shrink-0 text-[#568477]" />

                  <input
                    type="text"
                    value={searchInput || "Tokyo for 4 days"}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Where to next?"
                    className="w-full min-w-0 bg-transparent py-3 text-[15px] text-[#28352F] outline-none placeholder:text-[#8D9692]"
                  />
                </div>

                {/* CTA */}
                <button
                  onClick={onOpenModal}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-[#E3A06D] px-6 py-[14px] text-[14px] font-semibold text-[#26332E] transition-all duration-200 hover:bg-[#EAAE7C] hover:shadow-lg"
                >
                  <span>Create my trip</span>
                  <ArrowRight className="h-[16px] w-[16px]" />
                </button>
              </div>

              {/* Popular destinations */}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <span className="text-[#AEBBB5]">Popular:</span>

                {destinations.map((item) => (
                  <button
                    key={item}
                    onClick={() => setSearchInput(`${item} for 4 days`)}
                    className="text-[#D2DBD6] underline-offset-4 transition-colors hover:text-white hover:underline"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust points */}
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
              {["Free to start", "No sign-up needed", "Edit every detail"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-[13px] text-[#C4D0CA]"
                  >
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#54776C]/60">
                      <Check className="h-[12px] w-[12px] text-[#D9E5DF]" />
                    </span>

                    <span>{item}</span>
                  </div>
                )
              )}
            </div>
          </motion.div>

          {/* =====================================================
              RIGHT SIDE — ITINERARY CARD
          ====================================================== */}

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative flex justify-center lg:justify-end"
          >
            {/* Main card */}
            <div
              className="
                relative
                w-full
                max-w-[550px]
                rotate-[1.5deg]
                rounded-[30px]
                bg-[#FBFAF7]
                p-[15px]
                text-[#27342F]
                shadow-[0_30px_80px_rgba(0,0,0,0.32)]
              "
            >
              {/* =================================================
                  IMAGE HEADER
              ================================================== */}

              <div className="relative h-[245px] overflow-hidden rounded-[22px]">
                <img
                  src="https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1000&q=90"
                  alt="Tokyo skyline"
                  className="h-full w-full object-cover"
                />

                {/* image darkening */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                {/* Image text */}
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#D6E0DC]">
                    YOUR ITINERARY
                  </p>

                  <h3 className="font-serif text-[31px] leading-none">
                    4 days in Tokyo
                  </h3>
                </div>

                {/* Pace badge */}
                <div className="absolute bottom-6 right-5 rounded-full bg-white/20 px-3 py-[6px] text-[11px] font-medium text-white backdrop-blur-md">
                  Balanced pace
                </div>
              </div>

              {/* =================================================
                  ITINERARY ITEMS
              ================================================== */}

              <div className="space-y-3 pt-3">
                {/* Item 1 */}
                <div className="flex items-center justify-between rounded-[19px] border border-[#E6E3DE] bg-white px-4 py-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.025)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F1ED] text-[#4B8778]">
                      <Clock className="h-[17px] w-[17px]" />
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium tracking-wide text-[#9AA19E]">
                        09:00
                      </span>

                      <p className="mt-[2px] text-[15px] font-medium text-[#27342F]">
                        Tsukiji outer market
                      </p>
                    </div>
                  </div>

                  <span className="pr-1 text-[12px] font-mono text-[#A3AAA7]">
                    01
                  </span>
                </div>

                {/* Item 2 */}
                <div className="flex items-center justify-between rounded-[19px] border border-[#E6E3DE] bg-white px-4 py-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.025)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F1ED] text-[#4B8778]">
                      <Compass className="h-[17px] w-[17px]" />
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium tracking-wide text-[#9AA19E]">
                        12:30
                      </span>

                      <p className="mt-[2px] text-[15px] font-medium text-[#27342F]">
                        Meiji Shrine & Yoyogi
                      </p>
                    </div>
                  </div>

                  <span className="pr-1 text-[12px] font-mono text-[#A3AAA7]">
                    02
                  </span>
                </div>

                {/* Item 3 */}
                <div className="flex items-center justify-between rounded-[19px] border border-[#E6E3DE] bg-white px-4 py-[14px] opacity-[0.9] shadow-[0_2px_8px_rgba(0,0,0,0.025)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F1ED] text-[#4B8778]">
                      <Clock className="h-[17px] w-[17px]" />
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium tracking-wide text-[#9AA19E]">
                        17:00
                      </span>

                      <p className="mt-[2px] text-[15px] font-medium text-[#27342F]">
                        Shibuya golden hour
                      </p>
                    </div>
                  </div>

                  <span className="pr-1 text-[12px] font-mono text-[#A3AAA7]">
                    03
                  </span>
                </div>
              </div>

              {/* =================================================
                  SMART PACING FLOATING CARD
              ================================================== */}

              <div
                className="
                  absolute
                  -bottom-[34px]
                  -left-[48px]
                  z-30
                  rounded-[17px]
                  border
                  border-[#E9D8C7]
                  bg-[#FAEFE3]
                  px-5
                  py-4
                  shadow-[0_15px_35px_rgba(0,0,0,0.18)]
                "
              >
                <span className="block text-[11px] font-bold tracking-[0.13em] text-[#448578]">
                  SMART PACING
                </span>

                <p className="mt-1 text-[13px] font-medium text-[#27342F]">
                  Travel time already factored in
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* =========================================================
          FLOATING ACTION BUTTONS
      ========================================================== */}

      <div className="absolute bottom-5 right-5 z-30 flex flex-col items-center gap-3">
        <button
          className="
            flex h-[40px] w-[40px]
            items-center justify-center
            rounded-full
            bg-[#7199F2]
            text-white
            shadow-lg
            transition-transform
            hover:scale-105
          "
        >
          <Heart className="h-[20px] w-[20px]" />
        </button>

        <button
          className="
            flex h-[52px] w-[52px]
            items-center justify-center
            rounded-full
            bg-[#FAFAF8]
            text-[#6286DF]
            shadow-lg
            transition-transform
            hover:scale-105
          "
        >
          <Share2 className="h-[22px] w-[22px]" />
        </button>
      </div>
    </section>
  );
}