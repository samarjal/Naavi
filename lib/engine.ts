// engine.ts
//
// The Naavi Travel Engine. This file NEVER calls an LLM and NEVER makes a
// network request — it only scores, clusters, and packs plain data it's
// given. This is the deterministic core the project's thesis rests on:
// the LLM (Phase 7) only narrates what this file has already decided.
//
// How a day gets built, in plain terms:
//   1. Score every candidate place against the traveler's interests/rating.
//   2. Cluster places geographically into `duration` groups — so each day
//      covers one area of the destination instead of zigzagging across
//      the city. Clusters seed from the highest-scoring places, so the
//      areas that form naturally center on what the user is most likely
//      to enjoy.
//   3. Order the clusters themselves by their best match, so Day 1 covers
//      the area with the single best-matching place, Day 2 the next best
//      area, and so on.
//   4. Within a day: pick the highest-scoring feasible places (budget +
//      time), then route them in a sensible visiting order — starting at
//      the best match, then always heading to the nearest unvisited stop.

import type { Interests, ParsedProfile } from "@/lib/profile";
import type { PlaceRecord } from "@/lib/placesService";

type TripInput = {
  duration: number;
  budget: number | null;
};

// --- Geography ------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
const AVG_TRAVEL_SPEED_KMPH = 20; // matches the project's haversine-based
// travel-time estimate in place of a routing API — see README.

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function travelMinutesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const km = haversineKm(a, b);
  return Math.round((km / AVG_TRAVEL_SPEED_KMPH) * 60);
}

// --- Cost, honestly ---------------------------------------------------
//
// OpenTripMap doesn't provide pricing (documented limitation — see
// README). Rather than inventing a specific rupee figure and presenting
// it as fact, the engine assigns a labeled tier with an explicit range,
// clearly marked as an estimate. This is a heuristic proxy, and it says so
// wherever it's shown.

export const COST_TIERS = {
  free: { label: "Free", range: "₹0", upperBound: 0 },
  low: { label: "Low", range: "₹0–200 (estimated)", upperBound: 200 },
  moderate: {
    label: "Moderate",
    range: "₹200–600 (estimated)",
    upperBound: 600,
  },
  premium: { label: "Premium", range: "₹600+ (estimated)", upperBound: 800 },
} as const;

export type CostTierKey = keyof typeof COST_TIERS;

const CATEGORY_COST_TIER: Record<string, CostTierKey> = {
  nature: "free",
  architecture: "low",
  food: "moderate",
  shopping: "moderate",
  nightlife: "premium",
};
const DEFAULT_COST_TIER: CostTierKey = "low"; // covers "other"

export function estimateCostTier(category: string) {
  const key =
    CATEGORY_COST_TIER[category.toLowerCase().trim()] ?? DEFAULT_COST_TIER;
  return { key, ...COST_TIERS[key] };
}

// --- Time -----------------------------------------------------------
//
// A rough "how long would a typical visit take" estimate per category.
// Same honesty principle as cost: a heuristic, not a fact, but grounded
// enough to let the engine reason about whether a day is actually
// time-feasible rather than just budget-feasible.

const DURATION_ESTIMATES_MIN: Record<string, number> = {
  architecture: 90,
  nature: 60,
  food: 60,
  shopping: 45,
  nightlife: 90,
};
const DEFAULT_DURATION_MIN = 60; // covers "other"

export function estimateDurationMinutes(category: string): number {
  return (
    DURATION_ESTIMATES_MIN[category.toLowerCase().trim()] ??
    DEFAULT_DURATION_MIN
  );
}

const DAY_TIME_BUDGET_MIN: Record<string, number> = {
  relaxed: 240,
  balanced: 360,
  packed: 480,
};
const DEFAULT_DAY_TIME_BUDGET_MIN = 360;

// Walking tolerance stretches or shrinks the effective day length, since
// someone with low walking tolerance realistically covers less ground —
// reuses a preference already collected at onboarding instead of adding a
// new one.
const WALKING_TOLERANCE_MULTIPLIER: Record<string, number> = {
  low: 0.75,
  medium: 1,
  high: 1.25,
};

// --- Recommendation scoring -------------------------------------------
//
// Places arrive with a canonical NaaviCategory (see placesService.ts) that
// mirrors the Interests keys collected at onboarding, so matching a place
// to what the user said they like is a direct lookup — no provider-specific
// mapping table needed here. This is also what makes swapping providers
// (OpenTripMap → Google Places, say) safe: this file never sees a raw
// provider tag, only Naavi's own vocabulary.

const INTEREST_KEYS = new Set<keyof Interests>([
  "architecture",
  "food",
  "nature",
  "nightlife",
  "shopping",
]);

function interestMatchScore(category: string, interests: Interests): number {
  if (!INTEREST_KEYS.has(category as keyof Interests)) return 0.5; // "other" or unrecognized — neutral
  return interests[category as keyof Interests] / 10;
}

function ratingScore(rating: number | null): number {
  if (rating === null) return 0.5; // unknown rating — neutral
  return Math.min(rating / 3, 1); // OpenTripMap ratings mostly fall 0-3
}

export type ScoredPlace = PlaceRecord & { score: number };

const INTEREST_WEIGHT = 0.6;
const RATING_WEIGHT = 0.4;

/**
 * Scores every candidate place against the traveler's profile.
 * score = 0.6 × interest match + 0.4 × rating
 */
export function scorePlaces(
  profile: ParsedProfile,
  places: PlaceRecord[]
): ScoredPlace[] {
  return places
    .map((place) => {
      const interest = interestMatchScore(place.category, profile.interests);
      const rating = ratingScore(place.rating);
      const score = INTEREST_WEIGHT * interest + RATING_WEIGHT * rating;
      return { ...place, score };
    })
    .sort((a, b) => b.score - a.score);
}

// --- Feasibility --------------------------------------------------------

/**
 * Deterministic feasibility check for one candidate against remaining
 * budget for the day. A place can score well and still be infeasible for
 * a given slot — kept as its own explainable function on purpose.
 */
export function checkFeasibility(
  place: ScoredPlace,
  remainingDayBudget: number
): boolean {
  if (remainingDayBudget === Infinity) return true;
  return estimateCostTier(place.category).upperBound <= remainingDayBudget;
}

// --- Geographic clustering (which places go on which day) --------------

/**
 * Groups places into `k` geographic clusters using a small k-means pass.
 * Centroids seed from the top-scored places, so clusters naturally form
 * around what the user is likely to enjoy rather than purely by chance
 * geography. 5 iterations is plenty to converge on this small a dataset.
 */
function clusterByLocation(
  places: ScoredPlace[],
  k: number
): ScoredPlace[][] {
  if (places.length === 0 || k <= 0) return [];
  const actualK = Math.min(k, places.length);

  let centroids = places
    .slice(0, actualK)
    .map((p) => ({ lat: p.lat, lng: p.lng }));
  let assignments: number[] = new Array(places.length).fill(0);

  for (let iter = 0; iter < 5; iter++) {
    assignments = places.map((p) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      centroids.forEach((c, idx) => {
        const d = haversineKm(p, c);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      return bestIdx;
    });

    const sums = centroids.map(() => ({ latSum: 0, lngSum: 0, count: 0 }));
    places.forEach((p, i) => {
      const s = sums[assignments[i]];
      s.latSum += p.lat;
      s.lngSum += p.lng;
      s.count += 1;
    });
    centroids = sums.map((s, idx) =>
      s.count > 0
        ? { lat: s.latSum / s.count, lng: s.lngSum / s.count }
        : centroids[idx]
    );
  }

  const clusters: ScoredPlace[][] = Array.from({ length: actualK }, () => []);
  places.forEach((p, i) => clusters[assignments[i]].push(p));
  return clusters.filter((c) => c.length > 0);
}

// --- Route ordering within a day ----------------------------------------

/**
 * Orders a day's selected places into a sensible visiting route: start at
 * the highest-scoring place, then always move to the nearest unvisited
 * stop. This is a nearest-neighbor heuristic, not a true shortest-route
 * solver — appropriate for the small stop counts (2-4) an MVP day
 * actually has.
 */
function orderRoute(selected: ScoredPlace[]): ScoredPlace[] {
  if (selected.length <= 1) return selected;

  const remaining = [...selected].sort((a, b) => b.score - a.score);
  const route = [remaining.shift() as ScoredPlace];

  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((p, idx) => {
      const d = haversineKm(last, p);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });
    route.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return route;
}

// --- Day-packing (optimization) -----------------------------------------

const ACTIVITIES_PER_DAY: Record<string, number> = {
  relaxed: 2,
  balanced: 3,
  packed: 4,
};
const DEFAULT_ACTIVITIES_PER_DAY = 3;

export type PlannedActivity = {
  placeId: string;
  name: string;
  category: string;
  order: number;
  preferenceScore: number;
};

export type PlannedDay = {
  dayNumber: number;
  activities: PlannedActivity[];
};

export type ItineraryPlan = {
  days: PlannedDay[];
};

function buildDay(
  cluster: ScoredPlace[],
  budgetCap: number,
  timeCapMinutes: number,
  maxActivities: number
): PlannedActivity[] {
  // Phase 1: pick the best-scoring places that fit the day's budget.
  const sortedByScore = [...cluster].sort((a, b) => b.score - a.score);
  const selected: ScoredPlace[] = [];
  let spent = 0;

  for (const place of sortedByScore) {
    if (selected.length >= maxActivities) break;
    if (!checkFeasibility(place, budgetCap - spent)) continue;
    selected.push(place);
    spent += estimateCostTier(place.category).upperBound;
  }

  if (selected.length === 0) return [];

  // Phase 2: turn the selection into a sensible visiting route.
  const route = orderRoute(selected);

  // Phase 3: trim from the end if total time (visits + travel between
  // them) exceeds the day's time budget. Always keeps at least one stop.
  let cumulativeMinutes = 0;
  const finalStops: ScoredPlace[] = [];

  route.forEach((place, idx) => {
    const travelMinutes =
      idx === 0 ? 0 : travelMinutesBetween(route[idx - 1], place);
    const visitMinutes = estimateDurationMinutes(place.category);
    const totalIfAdded = cumulativeMinutes + travelMinutes + visitMinutes;

    if (totalIfAdded > timeCapMinutes && finalStops.length > 0) return;

    finalStops.push(place);
    cumulativeMinutes = totalIfAdded;
  });

  return finalStops.map((place, idx) => ({
    placeId: place.id,
    name: place.name,
    category: place.category,
    order: idx + 1,
    preferenceScore: place.score,
  }));
}

/**
 * Builds the full multi-day itinerary: scores places, clusters them
 * geographically into `duration` day-groups (best-matching areas first),
 * then packs and routes each day within its budget and time constraints.
 */
export function buildItinerary(
  profile: ParsedProfile,
  trip: TripInput,
  places: PlaceRecord[]
): ItineraryPlan {
  const ranked = scorePlaces(profile, places);
  const clusters = clusterByLocation(ranked, trip.duration);

  const orderedClusters = clusters
    .map((cluster) => ({
      cluster,
      maxScore: Math.max(...cluster.map((p) => p.score)),
    }))
    .sort((a, b) => b.maxScore - a.maxScore)
    .map((c) => c.cluster);

  const perDayBudget =
    trip.budget !== null ? trip.budget / trip.duration : Infinity;
  const baseTimeBudget =
    DAY_TIME_BUDGET_MIN[profile.travelStyle] ?? DEFAULT_DAY_TIME_BUDGET_MIN;
  const walkingMultiplier =
    WALKING_TOLERANCE_MULTIPLIER[profile.walkingTolerance] ?? 1;
  const dayTimeBudget = Math.round(baseTimeBudget * walkingMultiplier);
  const maxActivities =
    ACTIVITIES_PER_DAY[profile.travelStyle] ?? DEFAULT_ACTIVITIES_PER_DAY;

  const days: PlannedDay[] = [];
  for (let dayNumber = 1; dayNumber <= trip.duration; dayNumber++) {
    const cluster = orderedClusters[dayNumber - 1] ?? [];
    const activities = buildDay(
      cluster,
      perDayBudget,
      dayTimeBudget,
      maxActivities
    );
    days.push({ dayNumber, activities });
  }

  return { days };
}
