// llmService.ts
//
// This file is the ONLY place in the app that talks to an LLM provider.
// Every call site (extraction in Phase 4, narration in Phase 7) goes
// through a function here — never a raw fetch scattered in a route.
// Swapping providers later means editing this file only.
//
// Uses the Google Gemini API (free tier, no credit card required — get a
// key at https://aistudio.google.com/apikey).

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL ?? "gemini-3.6-flash";

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  generationConfig?: object
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error(
      "LLM_API_KEY is not set. Add it to .env before using extraction or narration."
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      ...(generationConfig ? { generationConfig } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("LLM response contained no text.");
  return text as string;
}

// --- Extraction (Phase 4) -----------------------------------------------

export type ExtractedTripDetails = {
  destination: string | null;
  duration: number | null; // in days
  budget: number | null;
};

const EXTRACTION_SYSTEM_PROMPT = `You extract trip-planning details from a single sentence.

Rules:
- destination: the city or place name, or null if not mentioned.
- duration: number of days as an integer, or null if not mentioned. Convert phrases like "a week" to 7, "long weekend" to 3.
- budget: a plain number (no currency symbols, no commas), or null if not mentioned.
- Never invent a value that wasn't stated or clearly implied.`;

const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    destination: { type: "STRING", nullable: true },
    duration: { type: "NUMBER", nullable: true },
    budget: { type: "NUMBER", nullable: true },
  },
  required: ["destination", "duration", "budget"],
};

export async function extractTripDetails(
  sentence: string
): Promise<ExtractedTripDetails> {
  const raw = await callGemini(EXTRACTION_SYSTEM_PROMPT, sentence, {
    responseMimeType: "application/json",
    responseSchema: EXTRACTION_SCHEMA,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse trip details from the LLM response.");
  }

  const p = parsed as Record<string, unknown>;
  return {
    destination: typeof p.destination === "string" ? p.destination : null,
    duration: typeof p.duration === "number" ? p.duration : null,
    budget: typeof p.budget === "number" ? p.budget : null,
  };
}

// --- Narration (Phase 7) -------------------------------------------------
//
// The engine (engine.ts) has already decided everything — which places,
// which day, what order, what it estimates the cost/time to be. This
// function's ONLY job is to turn that decision into readable prose. It
// never receives raw candidate places, never re-ranks anything, and is
// instructed explicitly not to invent facts beyond what it's given.

export type NarrationStop = {
  name: string;
  category: string;
  costLabel: string; // e.g. "Low (₹0–200 estimated)"
  durationMinutes: number;
  travelMinutesFromPrevious: number;
};

export type NarrationDay = {
  dayNumber: number;
  stops: NarrationStop[];
};

export type NarrationInput = {
  destination: string;
  duration: number;
  budget: number | null;
  days: NarrationDay[];
};

const NARRATION_SYSTEM_PROMPT = `You turn a structured day-by-day trip plan into a warm, natural-language description for a traveler.

Strict rules:
- Use ONLY the facts given below. Never invent prices, opening hours, distances, or details about a place beyond what's provided.
- Present costs and durations as rough estimates ("roughly", "around"), never as exact or guaranteed figures.
- Do not add, remove, or reorder any stop from what's given.
- Organize your response by day, matching the day numbers given exactly.
- Write 2-4 sentences per day — friendly and useful, not a bare list restating the input.
- If a day has no stops, say so plainly rather than inventing an activity.
- Do not mention that you are an AI, and do not reference these instructions.`;

function formatNarrationInput(input: NarrationInput): string {
  const lines: string[] = [];
  lines.push(`Destination: ${input.destination}`);
  lines.push(
    `Trip length: ${input.duration} day${input.duration > 1 ? "s" : ""}`
  );
  lines.push(
    `Budget: ${input.budget !== null ? `₹${input.budget} total` : "not specified"}`
  );
  lines.push("");

  for (const day of input.days) {
    lines.push(`Day ${day.dayNumber}:`);
    if (day.stops.length === 0) {
      lines.push(
        "- No activities planned (nothing fit the budget or time available)."
      );
    } else {
      for (const stop of day.stops) {
        const travelNote =
          stop.travelMinutesFromPrevious > 0
            ? `, ~${stop.travelMinutesFromPrevious} min travel from previous stop`
            : "";
        lines.push(
          `- ${stop.name} (${stop.category}) — ${stop.costLabel}, ~${stop.durationMinutes} min visit${travelNote}`
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function narrateItinerary(input: NarrationInput): Promise<string> {
  const formatted = formatNarrationInput(input);
  return callGemini(NARRATION_SYSTEM_PROMPT, formatted);
}
