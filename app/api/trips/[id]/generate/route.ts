import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getTravelerProfile } from "@/lib/profile";
import { getOrFetchPlaces } from "@/lib/placesService";
import { buildItinerary } from "@/lib/engine";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const trip = await db.trip.findUnique({ where: { id: params.id } });
  if (!trip || trip.userId !== user.id) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const profile = await getTravelerProfile(user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Complete onboarding before generating an itinerary." },
      { status: 400 }
    );
  }

  let places;
  try {
    places = await getOrFetchPlaces(trip.destination);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  // Engine call — pure, synchronous, no network. Everything above this
  // line was fetching inputs; everything below is persisting its output.
  const plan = buildItinerary(profile, trip, places);

  // Regenerating: wipe the previous itinerary for this trip first, since
  // the schema only allows one Itinerary per Trip (tripId is unique).
  const existing = await db.itinerary.findUnique({
    where: { tripId: trip.id },
  });
  if (existing) {
    await db.activity.deleteMany({
      where: { day: { itineraryId: existing.id } },
    });
    await db.day.deleteMany({ where: { itineraryId: existing.id } });
    await db.itinerary.delete({ where: { id: existing.id } });
  }

  const itinerary = await db.itinerary.create({
    data: {
      tripId: trip.id,
      days: {
        create: plan.days.map((day) => ({
          dayNumber: day.dayNumber,
          activities: {
            create: day.activities.map((a) => ({
              placeId: a.placeId,
              order: a.order,
              preferenceScore: a.preferenceScore,
            })),
          },
        })),
      },
    },
    include: { days: { include: { activities: true } } },
  });

  await db.trip.update({ where: { id: trip.id }, data: { status: "ready" } });

  return NextResponse.json({ itinerary });
}
