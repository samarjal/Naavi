// Standalone engine test — no DB, no server, no network calls.
// Run with: npm run test:engine
//
// Proves the engine is a pure, testable module independent of the rest of
// the app — useful evidence in a viva that the recommendation/feasibility/
// clustering/routing logic actually works, not just "looks right in the UI".

import { buildItinerary, estimateCostTier, estimateDurationMinutes } from "../lib/engine";
import type { ParsedProfile } from "../lib/profile";
import type { PlaceRecord } from "../lib/placesService";

const mockProfile: ParsedProfile = {
  id: "test-profile",
  travelStyle: "balanced",
  budgetPreference: "moderate",
  walkingTolerance: "medium",
  interests: {
    architecture: 9,
    food: 6,
    nature: 3,
    nightlife: 2,
    shopping: 5,
  },
};

// Two loose geographic clusters within Jaipur, so clustering has something
// real to separate: forts/palaces near the old city vs. Nahargarh up on
// the ridge.
const mockPlaces: PlaceRecord[] = [
  { id: "1", destination: "jaipur", name: "Amber Fort", category: "architecture", lat: 26.9855, lng: 75.8513, avgCost: null, rating: 3, source: "mock" },
  { id: "2", destination: "jaipur", name: "City Palace", category: "architecture", lat: 26.9258, lng: 75.8237, avgCost: null, rating: 2.5, source: "mock" },
  { id: "3", destination: "jaipur", name: "Nahargarh Fort", category: "architecture", lat: 26.9373, lng: 75.8155, avgCost: null, rating: 2, source: "mock" },
  { id: "4", destination: "jaipur", name: "Jal Mahal", category: "nature", lat: 26.9537, lng: 75.8463, avgCost: null, rating: 2, source: "mock" },
  { id: "5", destination: "jaipur", name: "Jantar Mantar", category: "architecture", lat: 26.9246, lng: 75.8247, avgCost: null, rating: 2.5, source: "mock" },
  { id: "6", destination: "jaipur", name: "Albert Hall Museum", category: "architecture", lat: 26.9114, lng: 75.8191, avgCost: null, rating: 2.5, source: "mock" },
];

const trip = { duration: 2, budget: 4000 };

const plan = buildItinerary(mockProfile, trip, mockPlaces);

console.log(`Engine test — high architecture interest (9/10), moderate budget, balanced style`);
console.log(`Trip: ${trip.duration} days, budget ₹${trip.budget}\n`);

let totalUpperBoundSpend = 0;

for (const day of plan.days) {
  console.log(`Day ${day.dayNumber}:`);
  day.activities.forEach((a, idx) => {
    const tier = estimateCostTier(a.category);
    const duration = estimateDurationMinutes(a.category);
    totalUpperBoundSpend += tier.upperBound;
    console.log(
      `  ${idx + 1}. ${a.name} (${a.category}) — ${tier.label} · ~${duration} min · ${Math.round(a.preferenceScore * 100)}% match`
    );
  });
  if (day.activities.length === 0) console.log("  (no feasible activities)");
}

console.log(`\nWorst-case total spend (all upper bounds): ₹${totalUpperBoundSpend} (budget: ₹${trip.budget})`);
console.log(
  totalUpperBoundSpend <= trip.budget!
    ? "✓ Within budget even in the worst case"
    : "✗ Exceeds budget — check checkFeasibility() logic"
);
