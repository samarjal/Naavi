import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTravelerProfile } from "@/lib/profile";
import TripRequestChat from "@/components/TripRequestChat";

export default async function NewTripPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Preferences must exist before we can score/rank anything against them
  // in later phases — send anyone who skipped onboarding back there first.
  const profile = await getTravelerProfile(user.id);
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Plan a trip</h1>
      <p className="mb-8 text-sm text-slate-500">
        Tell us where and for how long — your saved preferences handle the
        rest.
      </p>

      <TripRequestChat />
    </main>
  );
}
