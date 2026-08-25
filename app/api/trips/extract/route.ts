import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { extractTripDetails } from "@/lib/llmService";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Please describe the trip you want to plan." },
      { status: 400 }
    );
  }

  try {
    const extracted = await extractTripDetails(text.trim());
    return NextResponse.json({ extracted, rawText: text.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
