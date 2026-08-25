import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTravelerProfile } from "@/lib/profile";
import LogoutButton from "@/components/LogoutButton";

async function getHealth() {
  const { db } = await import("@/lib/db");
  try {
    const userCount = await db.user.count();
    const placeCount = await db.place.count();
    return { ok: true, userCount, placeCount };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export default async function Home() {
  const user = await getCurrentUser();

  // Logged in but never finished onboarding — send them there before
  // showing anything else. Covers both the post-signup case and anyone
  // who lands on "/" mid-quiz (e.g. closed the tab and came back).
  const profile = user ? await getTravelerProfile(user.id) : null;
  if (user && !profile) redirect("/onboarding");

  const health = await getHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold">Naavi</h1>

      {user ? (
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm">
          <p className="text-sm text-slate-600">
            Logged in as <span className="font-medium">{user.email}</span>
          </p>

          {profile && (
            <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Your travel preferences
              </h2>
              <p>
                Style: <span className="font-medium">{profile.travelStyle}</span>{" "}
                &middot; Budget:{" "}
                <span className="font-medium">{profile.budgetPreference}</span>{" "}
                &middot; Walking:{" "}
                <span className="font-medium">{profile.walkingTolerance}</span>
              </p>
              <p className="mt-1 text-slate-500">
                {Object.entries(profile.interests)
                  .map(([k, v]) => `${k} ${v}/10`)
                  .join(" · ")}
              </p>
            </div>
          )}

          {profile && (
            <a
              href="/trips/new"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Plan a trip
            </a>
          )}

          <LogoutButton />
        </div>
      ) : (
        <div className="flex gap-3">
          <a
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Log in
          </a>
          <a
            href="/signup"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign up
          </a>
        </div>
      )}

      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          Database status
        </h2>
        {health.ok ? (
          <div className="space-y-1 text-sm">
            <p className="text-emerald-600">✓ Connected</p>
            <p>Users in DB: {health.userCount}</p>
            <p>Places in DB: {health.placeCount}</p>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="text-red-600">✗ Not connected</p>
            <p className="text-slate-500">{health.error}</p>
            <p className="text-slate-500">
              Run <code>npm run prisma:migrate</code> first.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
