import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getOrFetchPlaces } from "@/lib/placesService";
import {
  estimateCostTier,
  estimateDurationMinutes,
  travelMinutesBetween,
} from "@/lib/engine";
import GenerateItineraryButton from "@/components/GenerateItineraryButton";
import NarrateItineraryButton from "@/components/NarrateItineraryButton";

async function getPlacesForTrip(destination: string) {
  try {
    const places = await getOrFetchPlaces(destination);
    return { ok: true as const, places };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export default async function TripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trip = await db.trip.findUnique({ where: { id: params.id } });
  if (!trip || trip.userId !== user.id) notFound();

  const placesResult = await getPlacesForTrip(trip.destination);

  const itinerary = await db.itinerary.findUnique({
    where: { tripId: trip.id },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
        include: {
          activities: {
            orderBy: { order: "asc" },
            include: { place: true },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">{trip.destination}</h1>
      <p className="mb-8 text-sm text-slate-500">
        {trip.duration} day{trip.duration > 1 ? "s" : ""}
        {trip.budget ? ` · Budget ${trip.budget}` : ""}
      </p>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Your original request
          </h2>
          <p className="text-sm text-slate-700">{trip.rawRequestText}</p>
        </div>

        <div>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </h2>
          <p className="text-sm capitalize text-slate-700">{trip.status}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Itinerary
          </h2>
          <div className="flex gap-2">
            <GenerateItineraryButton
              tripId={trip.id}
              hasItinerary={itinerary !== null}
            />
            {itinerary && (
              <NarrateItineraryButton
                tripId={trip.id}
                hasNarrative={!!itinerary.narrativeText}
              />
            )}
          </div>
        </div>

        {itinerary?.narrativeText && (
          <div className="mb-6 rounded-lg bg-slate-50 p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Your trip, in plain language
            </h3>
            <div className="whitespace-pre-line text-sm text-slate-700">
              {itinerary.narrativeText}
            </div>
          </div>
        )}

        {itinerary ? (
          <div className="space-y-6">
            {itinerary.narrativeText && (
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Structured plan (what the text above is based on)
              </h3>
            )}
            {itinerary.days.map((day) => {
              // Everything below is derived at render time from data we
              // already have (category, lat/lng, order) — nothing extra
              // was persisted for cost/duration/travel time.
              const stops = day.activities.map((a, idx) => {
                const tier = estimateCostTier(a.place.category);
                const duration = estimateDurationMinutes(a.place.category);
                const travelFromPrevious =
                  idx === 0
                    ? 0
                    : travelMinutesBetween(
                        day.activities[idx - 1].place,
                        a.place
                      );
                return { activity: a, tier, duration, travelFromPrevious };
              });

              return (
                <div key={day.id}>
                  <h3 className="mb-2 text-sm font-semibold">
                    Day {day.dayNumber}
                  </h3>
                  <ul className="space-y-2">
                    {stops.map(({ activity, tier, duration, travelFromPrevious }) => (
                      <li key={activity.id}>
                        {travelFromPrevious > 0 && (
                          <p className="py-1 pl-1 text-xs text-slate-400">
                            ↓ ~{travelFromPrevious} min to next stop
                          </p>
                        )}
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium">
                              {activity.place.name}
                            </p>
                            <p className="text-xs capitalize text-slate-500">
                              {activity.place.category} · ~{duration} min
                              visit
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>{tier.label}</p>
                            <p>
                              {Math.round(
                                (activity.preferenceScore ?? 0) * 100
                              )}
                              % match
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                    {stops.length === 0 && (
                      <li className="text-xs text-slate-400">
                        No feasible activities for this day within the
                        budget and time available.
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
            <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
              Days are grouped by geographic area (best-matching area
              first), stops are routed nearest-neighbor from the top match,
              and costs are shown as estimated ranges rather than exact
              figures — see README for why. Everything above this line was
              decided by the engine with no LLM involved; the paragraph at
              the top (if generated) is the LLM rephrasing these exact
              facts, nothing more.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No itinerary yet — click above to run the recommendation and
            day-packing engine for this trip.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Candidate places near {trip.destination}
        </h2>

        {placesResult.ok ? (
          <div className="space-y-2">
            <p className="text-xs text-emerald-600">
              ✓ {placesResult.places.length} places available to the engine
            </p>
            <ul className="divide-y divide-slate-100 text-sm">
              {placesResult.places.slice(0, 10).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-slate-400 capitalize">
                    {p.category}
                    {p.rating !== null ? ` · ★ ${p.rating}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {placesResult.places.length > 10 && (
              <p className="text-xs text-slate-400">
                +{placesResult.places.length - 10} more
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="text-red-600">✗ Couldn't fetch places</p>
            <p className="text-slate-500">{placesResult.error}</p>
          </div>
        )}
      </div>

      <a
        href="/trips/new"
        className="mt-6 inline-block text-sm font-medium text-slate-900 underline"
      >
        Plan another trip
      </a>
    </main>
  );
}
