# Naavi — Phase 7: LLM narration layer

Context-aware trip planning where a deterministic recommendation/feasibility
engine does the actual planning, and an LLM only narrates the result in
natural language.

## What's in Phase 7

- `lib/llmService.ts` — `narrateItinerary(input)` sends the already-decided
  itinerary (destination, budget, and each day's stops with their category,
  cost tier, visit duration, and travel time) to Gemini with a strict
  system prompt: use only the given facts, present costs/durations as
  estimates, never add/remove/reorder a stop, organize by day. The LLM's
  entire job is rephrasing a decision the engine already made — it never
  sees the raw candidate places and never re-ranks anything.
- `POST /api/trips/[id]/narrate` — builds the narration input using the
  **exact same** `estimateCostTier` / `estimateDurationMinutes` /
  `travelMinutesBetween` calls the structured display uses, so the
  narrated paragraph and the structured breakdown are guaranteed to
  describe identical facts. Saves the result to `Itinerary.narrativeText`
  (a field that's existed in the schema since Phase 1).
- `/trips/[id]` now shows the narrated paragraph prominently at the top of
  the itinerary card, with the structured day-by-day breakdown underneath
  labeled "what the text above is based on" — this pairing is the clearest
  single piece of evidence for the project's core thesis: the same facts,
  shown once as raw structured data, once as LLM prose.
- Re-narrating (via **Re-narrate**) simply overwrites `narrativeText`;
  regenerating the itinerary itself wipes it (a fresh plan needs fresh
  narration, and the old text would otherwise describe stops that no
  longer exist).

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `JWT_SECRET`, `LLM_API_KEY` (Gemini — same key extraction already
uses), `OPENTRIPMAP_API_KEY`.

```bash
npm run prisma:migrate
npm run dev
```

## Testing the flow

1. Generate an itinerary for a trip (Phase 6 flow)
2. Click **Narrate itinerary** — after a moment, a paragraph should appear
   above the structured breakdown
3. **Check it for hallucination**: read the narrated text against the
   structured plan below it. Every place name, cost tier, and duration
   mentioned should trace back to something literally present in the
   structured data — no invented opening hours, no invented exact prices,
   no activities that aren't in the list. This check is worth doing
   deliberately at least once, since it's the direct proof for your report
   that narration doesn't hallucinate.
4. Click **Re-narrate** — confirm it produces a differently-worded but
   factually identical paragraph
5. Click **Regenerate itinerary** (changes the underlying plan) — confirm
   the old narration disappears rather than describing stale stops

## Project structure

```
naavi/
  app/
    trips/[id]/page.tsx                shows narration + structured breakdown together
    api/trips/[id]/
      generate/route.ts
      narrate/route.ts                    builds narration input, saves narrativeText
  components/
    GenerateItineraryButton.tsx
    NarrateItineraryButton.tsx
  lib/
    engine.ts
    placesService.ts
    llmService.ts                        extraction (Phase 4) + narration (Phase 7)
    ...
  scripts/
    test-engine.ts
  prisma/
    schema.prisma
```

## Roadmap

1. ~~Project skeleton~~ ✓
2. ~~Auth (signup/login)~~ ✓
3. ~~Onboarding quiz → `TravelerProfile`~~ ✓
4. ~~Chat-styled trip request + one-shot LLM extraction~~ ✓
5. ~~Places cache + OpenTripMap fetch~~ ✓
6. ~~Naavi engine (recommendation + feasibility + geographic day-packing)~~ ✓
7. ~~LLM narration layer~~ ✓ ← you are here
8. Wire everything end-to-end (polish the flow from request → narrated result)
9. Polish for demo

## Architecture principle — the full pipeline is now real

Every stage from your original spec is now implemented and demonstrable:
`Trip` request → LLM extraction (Phase 4) → `Place` cache/fetch (Phase 5) →
scoring, clustering, feasibility, routing (Phase 6) → LLM narration (Phase
7) → UI. The LLM appears exactly twice, at the two ends of the pipeline,
and never in between — the middle is 100% deterministic code. This is the
whole thesis, working end-to-end.

The first version of the engine had two real problems: it invented a
specific rupee figure per place (implying precision the data doesn't
support) and OpenTripMap's broad `interesting_places` query let non-touristy
venues (cinemas, etc.) slip through. Both are fixed:

- **Places query narrowed** to `cultural,historic,architecture,natural,
  religion` instead of the broad catch-all, plus a keyword blacklist as a
  backstop.
- **Cost shown as a labeled tier + range** ("Low · ₹0–200 (estimated)")
  instead of a bare invented number — honest about being an estimate,
  never presented as fact.
- **Geographic clustering**: places are grouped into `duration` clusters by
  location (k-means on lat/lng, seeded from the top-scored places), so each
  day covers one area of the destination instead of zigzagging across the
  city. Clusters are then ordered by their best match, so Day 1 covers the
  area with the single best-matching place.
- **Route ordering within a day**: stops are visited starting at the best
  match, then always to the nearest unvisited stop (nearest-neighbor
  heuristic) — a real, explainable "how would a tourist actually walk
  this" order, computed from real coordinates.
- **Time-awareness**: each category gets a rough visit-duration estimate,
  and travel time between consecutive stops is computed from real
  distance. A day is packed against both its budget *and* its time budget
  (adjusted by travel style and walking tolerance), not budget alone.

**Important if you tested Phase 6 before this update**: the `Place` table
caches results per destination, so a destination you already generated an
itinerary for (e.g. "Jaipur") still has the old, broader-category data
saved. To see the improved filtering, either delete those cached rows via
`npm run prisma:studio` (Place table → delete rows where destination =
"jaipur") or test with a fresh destination you haven't used yet.

## Engine design notes (from Phase 6)

- `lib/engine.ts` — the Naavi Travel Engine. **Never calls an LLM, never
  makes a network request.** Key exports:
  - `scorePlaces()` — ranks candidates by `0.6 × interest match + 0.4 × rating`
  - `checkFeasibility()` — budget check for one candidate
  - `estimateCostTier()`, `estimateDurationMinutes()` — honest, labeled
    heuristic estimates, not invented facts
  - `haversineKm()`, `travelMinutesBetween()` — real distance/time math on
    real coordinates
  - `buildItinerary()` — clusters, orders, packs, and routes the full
    multi-day plan
- `POST /api/trips/[id]/generate` — runs the engine and persists
  `placeId`, `order`, and `preferenceScore` per activity. Cost tier,
  duration, and travel time are **computed at render time** from the
  place's category and coordinates — nothing extra needed to be stored,
  and it stays in sync if the heuristics are tuned later.
- `/trips/[id]` shows the full itinerary: day-by-day stops with cost tier,
  visit duration, travel time to the next stop, and preference match.
- `npm run test:engine` — standalone proof the algorithm works, no DB or
  server needed.

