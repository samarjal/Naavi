import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  estimateCostTier,
  estimateDurationMinutes,
  travelMinutesBetween,
} from "@/lib/engine";
import { narrateItinerary, type NarrationInput } from "@/lib/llmService";

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

  if (!itinerary) {
    return NextResponse.json(
      { error: "Generate the itinerary before narrating it." },
      { status: 400 }
    );
  }

  // Same estimateCostTier/estimateDurationMinutes/travelMinutesBetween
  // calls the display page uses — the narrated text and the structured
  // breakdown are guaranteed to describe the exact same facts, computed
  // the same way, since neither one invents anything of its own.
  const narrationInput: NarrationInput = {
    destination: trip.destination,
    duration: trip.duration,
    budget: trip.budget,
    days: itinerary.days.map((day) => ({
      dayNumber: day.dayNumber,
      stops: day.activities.map((a, idx) => {
        const tier = estimateCostTier(a.place.category);
        const duration = estimateDurationMinutes(a.place.category);
        const travel =
          idx === 0
            ? 0
            : travelMinutesBetween(day.activities[idx - 1].place, a.place);
        return {
          name: a.place.name,
          category: a.place.category,
          costLabel: `${tier.label} (${tier.range})`,
          durationMinutes: duration,
          travelMinutesFromPrevious: travel,
        };
      }),
    })),
  };

  let narrativeText: string;
  try {
    narrativeText = await narrateItinerary(narrationInput);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  await db.itinerary.update({
    where: { id: itinerary.id },
    data: { narrativeText },
  });

  return NextResponse.json({ narrativeText });
}
