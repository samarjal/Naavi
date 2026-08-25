import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Simple health check: if this succeeds, Prisma is correctly wired to the
// database and all 7 tables from schema.prisma exist and are queryable.
export async function GET() {
  try {
    const userCount = await db.user.count();
    const placeCount = await db.place.count();

    return NextResponse.json({
      status: "ok",
      db: "connected",
      counts: { users: userCount, places: placeCount },
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: (err as Error).message },
      { status: 500 }
    );
  }
}
