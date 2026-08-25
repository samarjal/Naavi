"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Interests = {
  architecture: number;
  food: number;
  nature: number;
  nightlife: number;
  shopping: number;
};

const TRAVEL_STYLES = [
  { value: "relaxed", label: "Relaxed", hint: "Few activities, lots of downtime" },
  { value: "balanced", label: "Balanced", hint: "A mix of activities and rest" },
  { value: "packed", label: "Packed", hint: "See as much as possible" },
];

const BUDGETS = [
  { value: "budget", label: "Budget", hint: "Keep costs low" },
  { value: "moderate", label: "Moderate", hint: "Some splurges are fine" },
  { value: "premium", label: "Premium", hint: "Prioritize quality over cost" },
];

const WALKING = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const INTEREST_LABELS: { key: keyof Interests; label: string }[] = [
  { key: "architecture", label: "Architecture & history" },
  { key: "food", label: "Food & dining" },
  { key: "nature", label: "Nature & outdoors" },
  { key: "nightlife", label: "Nightlife" },
  { key: "shopping", label: "Shopping" },
];

export default function OnboardingForm() {
  const router = useRouter();

  const [travelStyle, setTravelStyle] = useState("balanced");
  const [budgetPreference, setBudgetPreference] = useState("moderate");
  const [walkingTolerance, setWalkingTolerance] = useState("medium");
  const [interests, setInterests] = useState<Interests>({
    architecture: 5,
    food: 5,
    nature: 5,
    nightlife: 5,
    shopping: 5,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        travelStyle,
        budgetPreference,
        walkingTolerance,
        interests,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Travel style</legend>
        <div className="grid grid-cols-3 gap-2">
          {TRAVEL_STYLES.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setTravelStyle(opt.value)}
              className={`rounded-lg border px-3 py-3 text-left text-sm ${
                travelStyle === opt.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div
                className={`mt-0.5 text-xs ${
                  travelStyle === opt.value ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {opt.hint}
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Budget preference</legend>
        <div className="grid grid-cols-3 gap-2">
          {BUDGETS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setBudgetPreference(opt.value)}
              className={`rounded-lg border px-3 py-3 text-left text-sm ${
                budgetPreference === opt.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div
                className={`mt-0.5 text-xs ${
                  budgetPreference === opt.value
                    ? "text-slate-300"
                    : "text-slate-500"
                }`}
              >
                {opt.hint}
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Walking tolerance</legend>
        <div className="grid grid-cols-3 gap-2">
          {WALKING.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setWalkingTolerance(opt.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                walkingTolerance === opt.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">
          Rate your interests
        </legend>
        <div className="space-y-4">
          {INTEREST_LABELS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="text-slate-500">{interests[key]}/10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={interests[key]}
                onChange={(e) =>
                  setInterests((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save preferences"}
      </button>
    </form>
  );
}
