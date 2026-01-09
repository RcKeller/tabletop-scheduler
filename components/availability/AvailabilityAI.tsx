"use client";

import { useState } from "react";
import type { GeneralAvailability } from "@/lib/types";
import type { ParseResult } from "@/lib/ai/availability-parser";

interface RoutineRemoval {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
}

interface AvailabilityAIProps {
  timezone: string;
  onApply: (
    patterns: Omit<GeneralAvailability, "id" | "participantId">[],
    additions: Array<{ date: string; startTime: string; endTime: string }>,
    exclusions: Array<{ date: string; startTime?: string; endTime?: string; reason?: string }>,
    routineRemovals: RoutineRemoval[],
    mode: "replace" | "adjust",
    interpretation: string
  ) => void;
  currentPatterns: GeneralAvailability[];
}

export function AvailabilityAI({
  timezone,
  onApply,
}: AvailabilityAIProps) {
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;

    setIsParsing(true);
    setError(null);

    try {
      // Calculate current date/day in the viewing timezone FROM THE CLIENT
      const now = new Date();

      const dateFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const currentDate = dateFormatter.format(now);

      const dayFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
      });
      const currentDay = dayFormatter.format(now);

      const response = await fetch("/api/availability/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          timezone,
          currentDate,
          currentDay,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse");
      }

      const result = data as ParseResult;
      const hasChanges =
        result.patterns.length > 0 ||
        result.additions.length > 0 ||
        result.exclusions.length > 0 ||
        (result.routineRemovals?.length || 0) > 0;

      if (!hasChanges) {
        setError("We couldn't understand that. Try telling us specific days and times, like \"I'm free Saturdays from noon to 6pm\".");
        return;
      }

      // Apply the changes - parent handles undo stack
      onApply(
        result.patterns,
        result.additions,
        result.exclusions,
        result.routineRemovals || [],
        result.mode,
        result.interpretation
      );

      setText("");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        {/* Main input area */}
        <div className="flex-1 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Describe your availability and we&apos;ll update your schedule automatically.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., I'm usually free weekday evenings after 7, and most of Saturday"
            rows={4}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                e.preventDefault();
                handleParse();
              }
            }}
          />
          <button
            onClick={handleParse}
            disabled={isParsing || !text.trim()}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isParsing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Understanding...
              </span>
            ) : (
              "Update My Availability"
            )}
          </button>
        </div>

        {/* Examples sidebar */}
        <div className="w-48 shrink-0">
          <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Examples
            </p>
            <ul className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <li className="flex gap-1.5">
                <span className="text-green-500 shrink-0">+</span>
                <span>Free weeknights after 6</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-green-500 shrink-0">+</span>
                <span>Weekends work</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-green-500 shrink-0">+</span>
                <span>10pm to 2am works</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-red-400 shrink-0">-</span>
                <span>I work 9-5 M-F</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-red-400 shrink-0">-</span>
                <span>Busy next Thursday</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
