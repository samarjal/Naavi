// placesService.ts
//
// This file is the ONLY place in the app that talks to OpenTripMap.
// Everything downstream — the engine, any UI — reads Place rows from the
// DB using Naavi's OWN category vocabulary (NaaviCategory below), never a
// provider's raw tags. That's the actual swap point: moving to Google
// Places later means rewriting the fetch/geocode functions in this file
// and the PROVIDER_KIND_TO_CATEGORY table, and nothing else in the app
// changes — engine.ts, the UI, all of it stays untouched.
//
// Cache-once pattern: the first request for a destination hits OpenTripMap
// and saves normalized rows; every request after that reads only from the
// DB. This also makes the app resilient to API downtime during a live demo
// — once a destination is cached, it works with zero network dependency.

import { db } from "@/lib/db";

const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY;
const OPENTRIPMAP_BASE = "https://api.opentripmap.com/0.1/en/places";
const SEARCH_RADIUS_METERS = 10000; // 10km around the destination's center point
const MAX_PLACES = 30;

// --- Naavi's own category vocabulary -----------------------------------
//
// Every provider has a different taxonomy (OpenTripMap: "historic",
// "cultural"... Google Places: "tourist_attraction", "hindu_temple"...).
// The engine should never have to know which provider is in use, so every
// place gets normalized into this small, fixed set before it's saved.
// This mirrors the Interests keys collected at onboarding, so scoring a
// place against a user's interests is a direct lookup — no fuzzy mapping
// needed downstream.

export type NaaviCategory =
  | "architecture"
  | "food"
  | "nature"
  | "nightlife"
  | "shopping"
  | "other";

// Curated whitelist instead of the broad "interesting_places" catch-all —
// that umbrella pulls in cinemas, casinos, and other non-touristy noise.
const KINDS_WHITELIST = "cultural,historic,architecture,natural,religion";

// Backstop filter in case OpenTripMap tags something oddly (e.g. a venue
// classified under a whitelisted kind that's still clearly not a
// sightseeing attraction).
const KIND_BLACKLIST_KEYWORDS = [
  "cinema",
  "theatre",
  "casino",
  "bank",
  "mall",
  "industrial",
  "adult",
];

function isBlacklisted(kinds: string): boolean {
  const lower = kinds.toLowerCase();
  return KIND_BLACKLIST_KEYWORDS.some((k) => lower.includes(k));
}

// OpenTripMap-specific: maps its raw kind tags to Naavi's canonical
// categories. This table (plus the fetch/geocode functions below) is the
// ONLY thing that needs rewriting to swap providers later.
const OPENTRIPMAP_KIND_TO_CATEGORY: Record<string, NaaviCategory> = {
  historic: "architecture",
  architecture: "architecture",
  monuments: "architecture",
  cultural: "architecture",
  museums: "architecture",
  religion: "architecture",
  natural: "nature",
  gardens_and_parks: "nature",
  view_points: "nature",
  // Not currently fetched (outside KINDS_WHITELIST), but mapped now so
  // widening the whitelist later doesn't require touching this table.
  foods: "food",
  restaurants: "food",
  shops: "shopping",
  marketplaces: "shopping",
  amusements: "nightlife",
  nightclubs: "nightlife",
};

// OpenTripMap tags each place with multiple comma-separated kinds, often
// with the most specific one buried after generic ones. Scan all of them
// for a tag we recognize rather than blindly taking the first.
function normalizeCategory(kinds: string): NaaviCategory {
  const tags = kinds?.split(",").map((k) => k.trim()) ?? [];
  for (const tag of tags) {
    const mapped = OPENTRIPMAP_KIND_TO_CATEGORY[tag];
    if (mapped) return mapped;
  }
  return "other";
}

export type PlaceRecord = {
  id: string;
  destination: string;
  name: string;
  category: string; // always one of NaaviCategory in practice
  lat: number;
  lng: number;
  avgCost: number | null;
  rating: number | null;
  source: string;
};

// Cache key is lowercase/trimmed so "Jaipur" and "jaipur " hit the same
// cached rows instead of triggering duplicate API calls.
function normalizeDestination(destination: string): string {
  return destination.trim().toLowerCase();
}

async function geocodeDestination(
  destination: string
): Promise<{ lat: number; lon: number }> {
  if (!OPENTRIPMAP_API_KEY) {
    throw new Error(
      "OPENTRIPMAP_API_KEY is not set. Add it to .env before fetching places."
    );
  }

  const url = `${OPENTRIPMAP_BASE}/geoname?name=${encodeURIComponent(
    destination
  )}&apikey=${OPENTRIPMAP_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Could not look up "${destination}" (OpenTripMap ${res.status}).`
    );
  }

  const data = await res.json();
  if (typeof data.lat !== "number" || typeof data.lon !== "number") {
    throw new Error(`OpenTripMap couldn't locate "${destination}".`);
  }

  return { lat: data.lat, lon: data.lon };
}

type RawOTMPlace = {
  xid: string;
  name: string;
  kinds: string;
  rate?: number | string;
  point: { lon: number; lat: number };
};

async function fetchNearbyPlaces(
  lat: number,
  lon: number
): Promise<RawOTMPlace[]> {
  const url =
    `${OPENTRIPMAP_BASE}/radius?radius=${SEARCH_RADIUS_METERS}` +
    `&lon=${lon}&lat=${lat}&kinds=${KINDS_WHITELIST}` +
    `&format=json&limit=${MAX_PLACES}&apikey=${OPENTRIPMAP_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OpenTripMap places request failed (${res.status}).`);
  }

  return res.json();
}

// OpenTripMap's "rate" field is an inconsistent mix of numbers and short
// codes (some values include "h" for historic-cultural significance).
// Extract a numeric rating where possible; null otherwise rather than
// guessing.
function deriveRating(rate: number | string | undefined): number | null {
  if (typeof rate === "number") return rate;
  if (typeof rate === "string") {
    const parsed = parseFloat(rate);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Returns Place rows for a destination — from the cache if we've fetched
 * this destination before, otherwise from OpenTripMap (and saves the
 * result so the next call is a cache hit).
 *
 * Known limitation: OpenTripMap doesn't provide pricing, so avgCost is
 * always null for now — the engine estimates a cost tier from category
 * instead. This is a documented MVP scope boundary, not a bug — see
 * README.
 */
export async function getOrFetchPlaces(
  destination: string
): Promise<PlaceRecord[]> {
  const key = normalizeDestination(destination);

  const cached = await db.place.findMany({ where: { destination: key } });
  if (cached.length > 0) {
    return cached;
  }

  const { lat, lon } = await geocodeDestination(destination);
  const raw = await fetchNearbyPlaces(lat, lon);

  const candidates = raw
    .filter((p) => p.name && p.name.trim().length > 0)
    .filter((p) => !isBlacklisted(p.kinds))
    .map((p) => ({
      destination: key,
      name: p.name.trim(),
      category: normalizeCategory(p.kinds),
      lat: p.point.lat,
      lng: p.point.lon,
      avgCost: null as number | null,
      rating: deriveRating(p.rate),
      source: "opentripmap",
    }));

  if (candidates.length === 0) {
    throw new Error(
      `No places found for "${destination}". Try a different or more specific destination.`
    );
  }

  await db.place.createMany({ data: candidates });

  return db.place.findMany({ where: { destination: key } });
}
