import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOrFetchPlaces } from "@/lib/placesService";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const destination = req.nextUrl.searchParams.get("destination");
  if (!destination) {
    return NextResponse.json(
      { error: "destination query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const places = await getOrFetchPlaces(destination);
    return NextResponse.json({ places, count: places.length });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
