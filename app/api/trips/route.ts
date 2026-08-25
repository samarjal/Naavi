import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { destination, duration, budget, rawRequestText } = await req.json();

  if (!destination || typeof destination !== "string") {
    return NextResponse.json(
      { error: "Destination is required." },
      { status: 400 }
    );
  }
  if (!duration || typeof duration !== "number" || duration < 1 || duration > 30) {
    return NextResponse.json(
      { error: "Duration must be between 1 and 30 days." },
      { status: 400 }
    );
  }
  if (budget !== null && budget !== undefined && (typeof budget !== "number" || budget < 0)) {
    return NextResponse.json(
      { error: "Budget must be a positive number, or left blank." },
      { status: 400 }
    );
  }

  const trip = await db.trip.create({
    data: {
      userId: user.id,
      destination: destination.trim(),
      duration,
      budget: budget ?? null,
      rawRequestText: rawRequestText ?? "",
      status: "pending", // becomes "ready" once Phase 6-7 generate the itinerary
    },
  });

  return NextResponse.json({ trip });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const trips = await db.trip.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ trips });
}
