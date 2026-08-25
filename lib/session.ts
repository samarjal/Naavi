import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Reads the session cookie, verifies it, and returns the current user
 * (or null if not logged in / token invalid).
 *
 * Use this in server components and API routes — never trust the client
 * to tell you who's logged in.
 */
export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });

  return user;
}
