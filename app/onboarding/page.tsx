import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTravelerProfile } from "@/lib/profile";
import OnboardingForm from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Already has a profile (e.g. navigated here manually) — nothing new to
  // do, send them home instead of showing the quiz again.
  const existingProfile = await getTravelerProfile(user.id);
  if (existingProfile) redirect("/");

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">
        A few questions before we start
      </h1>
      <p className="mb-8 text-sm text-slate-500">
        This sets up your travel preferences once — every trip you plan
        afterward will use these automatically.
      </p>

      <OnboardingForm />
    </main>
  );
}
