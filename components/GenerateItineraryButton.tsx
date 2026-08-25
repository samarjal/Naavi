"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateItineraryButton({
  tripId,
  hasItinerary,
}: {
  tripId: string;
  hasItinerary: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/generate`, {
      method: "POST",
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading
          ? "Building itinerary..."
          : hasItinerary
          ? "Regenerate itinerary"
          : "Generate itinerary"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
