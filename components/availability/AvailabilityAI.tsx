"use client";

import { useState } from "react";
import type { GeneralAvailability } from "@/lib/types";
import type { ParseResult } from "@/lib/ai/availability-parser";

interface AvailabilityAIProps {
  timezone: string;
  onApply: (
    patterns: Omit<GeneralAvailability, "id" | "participantId">[],
    additions: Array<{ date: string; startTime: string; endTime: string }>,
    exclusions: Array<{ date: string; startTime?: string; endTime?: string; reason?: string }>,
    mode: "replace" | "adjust"
  ) => void;
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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
      // Calculate current date/day in the viewing timezone FROM THE CLIENT
      // This ensures we use the client's clock, not the server's
      const now = new Date();

      // Get current date in the viewing timezone
      const dateFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const currentDate = dateFormatter.format(now); // YYYY-MM-DD

      // Get current day of week in the viewing timezone
      const dayFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
      });
      const currentDay = dayFormatter.format(now); // e.g., "Tuesday"

      const response = await fetch("/api/availability/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          timezone,
          currentDate,  // Send client's calculated date
          currentDay,   // Send client's calculated day
        }),
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
    if (result) {
      onApply(result.patterns, result.additions, result.exclusions, result.mode);
      setText("");
      setResult(null);
    }
  };

  const handleCancel = () => {
    setResult(null);
  };

  const hasPatterns = result && result.patterns.length > 0;
  const hasAdditions = result && result.additions.length > 0;
  const hasExclusions = result && result.exclusions.length > 0;
  const hasChanges = hasPatterns || hasAdditions || hasExclusions;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Describe changes to your availability in plain English.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Examples:
        </p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-400 dark:text-zinc-500">
          <li>&bull; &quot;I&apos;m available Mon-Fri 6-10pm&quot; (sets weekly schedule)</li>
          <li>&bull; &quot;Also free Sunday the 12th from 5-7pm&quot; (adds specific time)</li>
          <li>&bull; &quot;Not available Wednesday the 14th&quot; (adds exclusion)</li>
          <li>&bull; &quot;I work 9-5 weekdays&quot; (exclusion - unavailable during work)</li>
        </ul>
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
            placeholder="e.g., I'm not available on Wednesday the 14th, but I can also do Sundays 5-7pm"
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
              "Parse Changes"
            )}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {/* Interpretation */}
          <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Understood:
            </h4>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
              {result.interpretation}
            </p>
            {result.mode === "replace" && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-500">
                This will set your weekly schedule.
              </p>
            )}
            {result.mode === "adjust" && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-500">
                This will adjust your existing availability.
              </p>
            )}
          </div>

          {/* Preview Changes */}
          <div className="space-y-3">
            {/* Weekly Patterns (additions) */}
            {hasPatterns && (
              <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <div className="border-b border-green-200 bg-green-100 px-4 py-2 dark:border-green-800 dark:bg-green-900/40">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Weekly Schedule ({result.patterns.length})
                  </h4>
                </div>
                <ul className="divide-y divide-green-100 dark:divide-green-800">
                  {result.patterns.map((slot, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        {DAYS[slot.dayOfWeek]}
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-400">
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specific Date Additions */}
            {hasAdditions && (
              <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <div className="border-b border-green-200 bg-green-100 px-4 py-2 dark:border-green-800 dark:bg-green-900/40">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Adding Availability ({result.additions.length})
                  </h4>
                </div>
                <ul className="divide-y divide-green-100 dark:divide-green-800">
                  {result.additions.map((slot, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        {formatDate(slot.date)}
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-400">
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Exclusions (removals) */}
            {hasExclusions && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <div className="border-b border-red-200 bg-red-100 px-4 py-2 dark:border-red-800 dark:bg-red-900/40">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                    Removing Availability ({result.exclusions.length})
                  </h4>
                </div>
                <ul className="divide-y divide-red-100 dark:divide-red-800">
                  {result.exclusions.map((exc, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                          {formatDate(exc.date)}
                        </span>
                        {exc.reason && (
                          <span className="ml-2 text-xs text-red-500 dark:text-red-400">
                            ({exc.reason})
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-red-600 dark:text-red-400">
                        {exc.startTime && exc.endTime
                          ? `${formatTime(exc.startTime)} - ${formatTime(exc.endTime)}`
                          : "All day"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasChanges && (
              <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                No changes detected. Try describing your availability or unavailability more clearly.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanges}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
