import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const VALID_TRAVEL_STYLE = ["relaxed", "balanced", "packed"];
const VALID_BUDGET = ["budget", "moderate", "premium"];
const VALID_WALKING = ["low", "medium", "high"];
const INTEREST_KEYS = [
  "architecture",
  "food",
  "nature",
  "nightlife",
  "shopping",
] as const;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const { travelStyle, budgetPreference, walkingTolerance, interests } = body;

  if (!VALID_TRAVEL_STYLE.includes(travelStyle)) {
    return NextResponse.json(
      { error: "Invalid travel style." },
      { status: 400 }
    );
  }
  if (!VALID_BUDGET.includes(budgetPreference)) {
    return NextResponse.json(
      { error: "Invalid budget preference." },
      { status: 400 }
    );
  }
  if (!VALID_WALKING.includes(walkingTolerance)) {
    return NextResponse.json(
      { error: "Invalid walking tolerance." },
      { status: 400 }
    );
  }
  if (
    typeof interests !== "object" ||
    interests === null ||
    !INTEREST_KEYS.every(
      (k) =>
        typeof interests[k] === "number" &&
        interests[k] >= 1 &&
        interests[k] <= 10
    )
  ) {
    return NextResponse.json(
      { error: "Interests must be numbers from 1-10 for every category." },
      { status: 400 }
    );
  }

  // Upsert rather than create-only: lets a user retake the quiz later
  // (e.g. from a future "edit preferences" screen) without extra code.
  await db.travelerProfile.upsert({
    where: { userId: user.id },
    update: {
      travelStyle,
      budgetPreference,
      walkingTolerance,
      interests: JSON.stringify(interests),
    },
    create: {
      userId: user.id,
      travelStyle,
      budgetPreference,
      walkingTolerance,
      interests: JSON.stringify(interests),
    },
  });

  return NextResponse.json({ ok: true });
}
