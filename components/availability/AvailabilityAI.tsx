"use client";

import { useState } from "react";
import type { GeneralAvailability } from "@/lib/types";

interface AvailabilityAIProps {
  timezone: string;
  onApply: (patterns: Omit<GeneralAvailability, "id" | "participantId">[]) => void;
  currentPatterns: GeneralAvailability[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = parseInt(hourStr);
  if (hour === 0) return `12:${minute} AM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  return `${hour - 12}:${minute} PM`;
}

interface ParsedSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ParseResult {
  slots: ParsedSlot[];
  interpretation: string;
}

export function AvailabilityAI({
  timezone,
  onApply,
  currentPatterns,
}: AvailabilityAIProps) {
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;

    setIsParsing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/availability/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), timezone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = () => {
    if (result?.slots) {
      onApply(result.slots);
      setText("");
      setResult(null);
    }
  };

  const handleCancel = () => {
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Describe your availability in plain English and we&apos;ll convert it to time slots.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Examples: &quot;Available evenings Mon-Fri&quot; or &quot;Free 7pm-10pm on weekends&quot;
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!result ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., I'm available Tuesday and Thursday evenings from 6-10pm, and weekends anytime after noon"
            rows={4}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />

          <button
            onClick={handleParse}
            disabled={isParsing || !text.trim()}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isParsing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              "Parse Availability"
            )}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <h4 className="text-sm font-medium text-green-800 dark:text-green-300">
              Understood:
            </h4>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              {result.interpretation}
            </p>
          </div>

          <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Time Slots ({result.slots.length})
              </h4>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {result.slots.map((slot, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {DAYS[slot.dayOfWeek]}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Apply Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
