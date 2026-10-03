import { Clock, ArrowRight, ArrowUpRight } from "lucide-react";
import { guides } from "../data";

export default function Guides() {
  return (
    <section className="bg-[#FCF9F5] px-6 py-[72px] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-[1100px]">

        {/* ================= HEADER ================= */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#32766C]">
            FRESH FROM THE FIELD GUIDE
          </p>

          <div className="mt-[8px] flex items-end justify-between">
            <h2 className="font-serif text-[35px] font-normal leading-[1.05] tracking-[-0.025em] text-[#1D3631] sm:text-[38px]">
              New routes, local details.
            </h2>
          </div>

          <div className="mt-[10px] flex items-center justify-between">
            <p className="text-[11px] leading-relaxed text-[#5D716C] sm:text-[12px]">
              Recently updated ideas to help you decide what belongs in your days.
            </p>

            <a
              href="#"
              className="hidden items-center gap-1 text-[9px] font-semibold text-[#286C62] transition-colors hover:text-[#1C4E47] sm:flex"
            >
              Read all travel guides
              <ArrowUpRight size={11} strokeWidth={1.8} />
            </a>
          </div>
        </div>

        {/* ================= GUIDE GRID ================= */}
        <div className="mt-[28px] grid grid-cols-1 gap-6 md:grid-cols-3">

          {guides.map(([country, date, title, desc, image]) => (
            <article
              key={title}
              className="
                group
                overflow-hidden
                rounded-[16px]
                border
                border-[#E4E3DF]
                bg-white
                shadow-[0_5px_18px_rgba(31,52,47,0.035)]
                transition-all
                duration-300
                hover:-translate-y-[2px]
                hover:shadow-[0_12px_28px_rgba(31,52,47,0.08)]
              "
            >
              {/* ================= IMAGE ================= */}
              <div className="relative h-[150px] overflow-hidden bg-[#E8E8E3]">

                {image ? (
                  <img
                    src={image}
                    alt={title}
                    className="
                      h-full
                      w-full
                      object-cover
                      transition-transform
                      duration-500
                      group-hover:scale-[1.035]
                    "
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-b from-[#DADDD8] to-[#BFC8C3]" />
                )}

                {/* Image overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

                {/* Country */}
                <span
                  className="
                    absolute
                    left-[11px]
                    top-[11px]
                    rounded-full
                    bg-[#FAFAF7]
                    px-[9px]
                    py-[4px]
                    text-[7px]
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-[#35756C]
                    shadow-[0_2px_6px_rgba(0,0,0,0.06)]
                  "
                >
                  {country}
                </span>
              </div>

              {/* ================= CONTENT ================= */}
              <div className="px-[14px] pb-[16px] pt-[13px]">

                {/* Date */}
                <p className="flex items-center gap-[5px] text-[8px] font-medium uppercase tracking-[0.04em] text-[#8A918E]">
                  <Clock
                    size={9}
                    strokeWidth={1.5}
                    className="text-[#E49A70]"
                  />
                  {date}
                </p>

                {/* Title */}
                <h3
                  className="
                    mt-[8px]
                    font-serif
                    text-[16px]
                    font-normal
                    leading-[1.05]
                    tracking-[-0.015em]
                    text-[#182F2A]
                  "
                >
                  {title}
                </h3>

                {/* Description */}
                <p
                  className="
                    mt-[9px]
                    min-h-[47px]
                    text-[9px]
                    leading-[1.55]
                    text-[#637570]
                  "
                >
                  {desc}
                </p>

                {/* Read guide */}
                <a
                  href="#"
                  className="
                    mt-[13px]
                    inline-flex
                    items-center
                    gap-[5px]
                    text-[8px]
                    font-bold
                    uppercase
                    tracking-[0.13em]
                    text-[#277066]
                  "
                >
                  <span>Read the guide</span>

                  <ArrowRight
                    size={10}
                    strokeWidth={1.8}
                    className="
                      transition-transform
                      duration-200
                      group-hover:translate-x-1
                    "
                  />
                </a>
              </div>
            </article>
          ))}

        </div>
      </div>
    </section>
  );
}