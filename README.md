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
OPENTRIPMAP (real attractions, ratings, price level, opening hours)
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
- **Real places, real data** — OPENTRIPMAP (New) integration: genuine
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
| Places data | OPENTRIPMAP API (New) — attractions, ratings, price level, opening hours |

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
- `OPENTRIPMAP_API_KEY` — a free OPENTRIPMAP api key to fetch places data

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
