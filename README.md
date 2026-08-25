# Naavi

**A context-aware travel itinerary planner where a deterministic recommendation
and feasibility engine plans the trip, and an LLM only extracts input and
narrates the output — never the other way around.**

Naavi is not a "describe your trip to ChatGPT" wrapper. Every itinerary is
built by a real recommendation-feasibility-optimization pipeline that scores
places, clusters them geographically, checks real budgets/time/opening
hours, and routes them sensibly — all before an LLM ever sees the result.

---

## Why this exists

Most "AI travel planner" projects are a single prompt to an LLM asking it to
invent an itinerary — which means the itinerary is only as good as whatever
the model hallucinates about opening hours, prices, and distances that day.

Naavi inverts this: the **planning logic is deterministic code**, the
**data is real** (Google Places, including live opening hours and price
signals), and the LLM is confined to two narrow, explainable jobs —
understanding what the user typed, and writing up what the engine decided.

```
User sentence
    ↓
LLM extraction (destination, duration, budget)
    ↓
Google Places (real attractions, ratings, price level, opening hours)
    ↓
Naavi Engine — 100% deterministic, zero network/LLM calls:
    • scores places against the user's stated interests
    • clusters them geographically, one area per day
    • routes each day nearest-neighbor from the best match
    • validates every stop against budget, time, and real opening hours
    ↓
(optional) Gemini chooses among already-validated options, when there's
a genuine surplus — never decides feasibility itself
    ↓
LLM narration — rephrases the finished plan into prose, adds no new facts
    ↓
User sees only the narrated result
```

---

## Features

- **Account + onboarding** — sign up, then a short preferences quiz
  (travel style, budget preference, walking tolerance, interest ratings)
  saved once and reused for every future trip
- **Conversational trip request** — type a sentence like *"plan a 3 day
  trip to Jaipur, budget 20000"*; the assistant asks a quick follow-up in
  chat if something's missing, then plans automatically
- **Real places, real data** — Google Places (New) integration: genuine
  attractions, ratings, price-level signals, and real opening/closing
  hours, cached per destination
- **A real recommendation engine** — multi-factor scoring
  (`0.6 × interest match + 0.4 × rating`), k-means geographic clustering,
  nearest-neighbor route ordering, and budget/time/opening-hours
  feasibility checks — fully deterministic and independently testable
- **Hybrid LLM-assisted selection** — when the engine finds more feasible
  options for a day than it needs, Gemini chooses the best combination
  from that already-validated shortlist; it can structurally never
  introduce an infeasible option, and falls back to the engine's own
  deterministic pick if the call fails
- **Natural-language narration** — the finished itinerary is rephrased
  into a readable day-by-day plan, with the underlying structured
  breakdown available on demand for full transparency

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma (swap to Postgres by changing one line for production) |
| Auth | JWT in an httpOnly cookie (`jose`), password hashing (`bcryptjs`) |
| LLM | Google Gemini (free tier) — extraction, narration, bounded reranking |
| Places data | Google Places API (New) — attractions, ratings, price level, opening hours |

---

## Architecture

```
app/
  trips/new/page.tsx           conversational trip request (chat UI)
  trips/[id]/page.tsx           narrated result + collapsible engine breakdown
  api/
    trips/extract/route.ts        one-shot LLM extraction from free text
    trips/[id]/generate/route.ts   orchestrates engine + optional Gemini reranking
    trips/[id]/narrate/route.ts    LLM narration of the finished plan
    onboarding/route.ts
    auth/...
lib/
  engine.ts          the Naavi Engine — scoring, clustering, routing,
                      budget/time/hours feasibility. Never calls an LLM
                      or the network. Independently testable.
  placesService.ts    the only file that talks to Google Places
  llmService.ts       the only file that talks to Gemini (extraction,
                      narration, bounded reranking)
  profile.ts / auth.ts / session.ts / db.ts
scripts/
  test-engine.ts      standalone proof the engine works with zero
                      network/LLM involvement — npm run test:engine
prisma/
  schema.prisma       User, TravelerProfile, Trip, Place, Itinerary, Day, Activity
```

**The one rule the whole project is built around:** `engine.ts` never
imports anything LLM-related. Every recommendation, every feasibility
check, every route ordering decision is plain, deterministic code —
provable with `npm run test:engine`, which produces the same output every
time with no network access at all.

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in:
- `JWT_SECRET` — any long random string (`openssl rand -base64 32`)
- `LLM_API_KEY` — a free Gemini key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit card needed)
- `GOOGLE_PLACES_API_KEY` — from [Google Cloud Console](https://console.cloud.google.com): enable **Places API (New)**, attach a billing account (required by Google to issue the key, but a student project's usage stays within the free tier), then create a restricted API key

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Verify the engine independently (optional but recommended)

```bash
npm run test:engine
```

Runs the recommendation/feasibility/clustering logic against fixed mock
data with no server, database, or network involved — proof the core
algorithm works on its own.

---

## Known limitations

- **Opening hours are a representative daily window, not date-specific.**
  The app doesn't currently collect the trip's exact calendar start date,
  so Google's per-weekday hours are approximated by a single "typical day"
  window rather than mapped to the trip's real dates. Documented in code
  and shown as an estimate wherever displayed.
- **Costs are tiered estimates, not live prices.** A real `priceLevel`
  signal from Google is used when available; otherwise a category-based
  heuristic tier is shown, always labeled as an estimate.
- **No true multi-turn conversational agent.** The chat interface handles
  one-shot extraction plus simple slot-filling follow-ups (missing
  destination/duration) — not open-ended back-and-forth planning.

---

## Roadmap / possible extensions

- Behavioral personalization from repeated trip feedback
- Dynamic re-planning (e.g. weather-triggered activity swaps)
- Gamification / progress tracking
- Multi-provider LLM support (the `llmService.ts` abstraction already
  isolates this)

---

## License

This is an academic project built for a final-year engineering major
project. Add a license here if you intend to open-source it.