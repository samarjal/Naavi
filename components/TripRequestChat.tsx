"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ExtractedDetails = {
  destination: string | null;
  duration: number | null;
  budget: number | null;
};

export default function TripRequestChat() {
  const router = useRouter();

  const [step, setStep] = useState<"ask" | "confirm">("ask");
  const [text, setText] = useState("");
  const [rawText, setRawText] = useState("");
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [budget, setBudget] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/trips/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const data: { extracted: ExtractedDetails; rawText: string } = await res.json();
    setRawText(data.rawText);
    setDestination(data.extracted.destination ?? "");
    setDuration(data.extracted.duration ?? "");
    setBudget(data.extracted.budget ?? "");
    setStep("confirm");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!destination.trim()) {
      setError("Destination is required.");
      return;
    }
    if (!duration || Number(duration) < 1) {
      setError("Duration must be at least 1 day.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: destination.trim(),
        duration: Number(duration),
        budget: budget === "" ? null : Number(budget),
        rawRequestText: rawText,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const data = await res.json();
    router.push(`/trips/${data.trip.id}`);
  }

  if (step === "ask") {
    return (
      <form onSubmit={handleExtract} className="space-y-3">
        <div className="rounded-2xl rounded-bl-sm bg-slate-900 px-4 py-3 text-sm text-white">
          Where would you like to go, and for how long?
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Plan a 3 day trip to Jaipur, budget around 20000"
          rows={3}
          className="w-full rounded-2xl rounded-br-sm border border-slate-300 bg-white px-4 py-3 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Reading your request..." : "Send"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-4">
      <div className="rounded-2xl rounded-bl-sm bg-slate-900 px-4 py-3 text-sm text-white">
        Here's what I understood — check it over and fix anything that's off.
      </div>

      <div className="space-y-3 rounded-2xl rounded-br-sm border border-slate-300 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Destination
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Jaipur"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Duration (days)
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={duration}
            onChange={(e) =>
              setDuration(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Budget <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="number"
            min={0}
            value={budget}
            onChange={(e) =>
              setBudget(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Leave blank if not sure yet"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStep("ask")}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving..." : "Confirm trip"}
        </button>
      </div>
    </form>
  );
}
