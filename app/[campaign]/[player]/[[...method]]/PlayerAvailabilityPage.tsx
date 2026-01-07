"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { startOfWeek, parseISO } from "date-fns";
import Link from "next/link";
import { AvailabilityGrid } from "@/components/availability/AvailabilityGrid";
import { AvailabilityAI } from "@/components/availability/AvailabilityAI";
import { GeneralAvailabilityEditor } from "@/components/availability/GeneralAvailabilityEditor";
import { WeekNavigator } from "@/components/navigation/WeekNavigator";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import type { TimeSlot, GeneralAvailability as GeneralAvailabilityType } from "@/lib/types";

interface EventProps {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  earliestTime: string;
  latestTime: string;
  sessionLengthMinutes: number;
  gameSystem: { id: string; name: string } | null;
}

interface ParticipantProps {
  id: string;
  displayName: string;
  isGm: boolean;
}

interface PlayerAvailabilityPageProps {
  event: EventProps;
  participant: ParticipantProps;
  method: "select" | "pattern" | "describe";
}

const METHOD_LABELS = {
  select: "Calendar",
  pattern: "Recurring",
  describe: "AI Assistant",
};

const METHOD_DESCRIPTIONS = {
  select: "Click and drag to mark when you're free this week",
  pattern: "Set your typical weekly schedule",
  describe: "Tell us in plain English when you're available",
};

export function PlayerAvailabilityPage({
  event,
  participant,
  method,
}: PlayerAvailabilityPageProps) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(event.timezone);
  const [effectiveAvailability, setEffectiveAvailability] = useState<TimeSlot[]>([]);
  const [generalAvailability, setGeneralAvailability] = useState<GeneralAvailabilityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const eventStartDate = useMemo(() => {
    return event.startDate ? parseISO(event.startDate) : new Date();
  }, [event.startDate]);

  const eventEndDate = useMemo(() => {
    return event.endDate ? parseISO(event.endDate) : eventStartDate;
  }, [event.endDate, eventStartDate]);

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(eventStartDate, { weekStartsOn: 0 })
  );

  const playerSlug = participant.displayName.toLowerCase().replace(/\s+/g, "-");

  // Load existing availability
  const loadAvailability = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (event.startDate) params.set("startDate", event.startDate.split("T")[0]);
      if (event.endDate) params.set("endDate", event.endDate.split("T")[0]);
      if (event.earliestTime) params.set("earliestTime", event.earliestTime);
      if (event.latestTime) params.set("latestTime", event.latestTime);

      const url = `/api/availability/${participant.id}${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        setEffectiveAvailability(
          data.effectiveAvailability.map((a: { date: string; startTime: string; endTime: string }) => ({
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
          }))
        );
        setGeneralAvailability(data.generalAvailability);
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
    } finally {
      setIsLoading(false);
    }
  }, [participant.id, event.startDate, event.endDate, event.earliestTime, event.latestTime]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability, loadKey]);

  // Store participant in localStorage
  useEffect(() => {
    localStorage.setItem(`participant_${event.id}`, participant.id);
  }, [event.id, participant.id]);

  // Auto-save for Select Times
  const handleAutoSaveAvailability = useCallback(async (slots: TimeSlot[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: slots }),
      });
      if (res.ok) {
        setEffectiveAvailability(slots);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("Failed to save availability:", error);
    } finally {
      setIsSaving(false);
    }
  }, [participant.id]);

  // Save general availability patterns
  const handleSaveGeneralAvailability = async (patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalAvailability: patterns }),
      });
      if (res.ok) {
        setGeneralAvailability(patterns.map((p, i) => ({
          ...p,
          id: `temp-${i}`,
          participantId: participant.id,
        })));
        await new Promise(resolve => setTimeout(resolve, 100));
        setLoadKey((k) => k + 1);
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Failed to save general availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset
  const handleReset = async () => {
    if (!confirm("Are you sure you want to clear all your availability?")) return;

    setIsSaving(true);
    try {
      await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: [],
          generalAvailability: [],
          exceptions: [],
        }),
      });
      setEffectiveAvailability([]);
      setGeneralAvailability([]);
      setLoadKey((k) => k + 1);
    } catch (error) {
      console.error("Failed to reset availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // AI applies patterns, additions, and exclusions
  const handleAIApply = async (
    patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[],
    additions: Array<{ date: string; startTime: string; endTime: string }>,
    exclusions: Array<{ date: string; startTime?: string; endTime?: string; reason?: string }>,
    mode: "replace" | "adjust"
  ) => {
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {};

      if (patterns.length > 0) {
        if (mode === "replace") {
          body.generalAvailability = patterns;
        } else {
          const existingByDay = new Map<number, GeneralAvailabilityType[]>();
          for (const p of generalAvailability) {
            const existing = existingByDay.get(p.dayOfWeek) || [];
            existing.push(p);
            existingByDay.set(p.dayOfWeek, existing);
          }

          const mergedPatterns: Omit<GeneralAvailabilityType, "id" | "participantId">[] = [];
          const daysWithNewPatterns = new Set(patterns.map(p => p.dayOfWeek));

          for (const p of generalAvailability) {
            if (!daysWithNewPatterns.has(p.dayOfWeek)) {
              mergedPatterns.push({
                dayOfWeek: p.dayOfWeek,
                startTime: p.startTime,
                endTime: p.endTime,
              });
            }
          }

          for (const p of patterns) {
            mergedPatterns.push(p);
          }

          body.generalAvailability = mergedPatterns;
          body.clearSpecificOnPatternSave = false;
        }
      }

      if (additions.length > 0) {
        if (mode === "adjust") {
          const existingSlots = new Set(
            effectiveAvailability.map(s => `${s.date}|${s.startTime}|${s.endTime}`)
          );
          const newSlots = [
            ...effectiveAvailability,
            ...additions.filter(a => !existingSlots.has(`${a.date}|${a.startTime}|${a.endTime}`))
          ];
          body.availability = newSlots;
        } else {
          body.availability = additions;
        }
      }

      if (exclusions.length > 0) {
        const exceptions = exclusions.map(exc => ({
          date: exc.date,
          startTime: exc.startTime || "00:00",
          endTime: exc.endTime || "23:59",
          reason: exc.reason,
        }));
        body.exceptions = exceptions;
        if (mode === "adjust") {
          body.appendExceptions = true;
        }
      }

      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/availability/${participant.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setLoadKey((k) => k + 1);
        }
      }
    } catch (error) {
      console.error("Failed to apply AI changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDone = () => {
    router.push(`/${event.slug}`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href={`/${event.slug}`}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{event.title}</p>
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {participant.displayName}'s Availability
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <span className="text-xs text-zinc-500">Saving...</span>
              )}
              <button
                onClick={handleReset}
                className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Clear All
              </button>
              <button
                onClick={handleDone}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Method Selection */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-2">Input method:</span>
              {(["select", "pattern", "describe"] as const).map((m) => (
                <Link
                  key={m}
                  href={`/${event.slug}/${playerSlug}${m === "select" ? "" : `/${m}`}`}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    method === m
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {METHOD_LABELS[m]}
                </Link>
              ))}
            </div>
            <TimezoneSelector value={timezone} onChange={setTimezone} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-3 py-3">
        {isLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-3">
              {/* Skeleton for grid */}
              <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "300px" }} />
              <div className="flex justify-between">
                <div className="h-8 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-8 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Method description */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {METHOD_DESCRIPTIONS[method]}
              </p>
            </div>

            {/* Method content */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {method === "select" && (
                <div className="p-2">
                  <div className="mb-2">
                    <WeekNavigator
                      currentWeekStart={currentWeekStart}
                      eventStartDate={eventStartDate}
                      eventEndDate={eventEndDate}
                      onWeekChange={setCurrentWeekStart}
                    />
                  </div>
                  <AvailabilityGrid
                    availability={effectiveAvailability}
                    timezone={timezone}
                    eventTimezone={event.timezone}
                    onSave={handleAutoSaveAvailability}
                    isSaving={isSaving}
                    weekStart={currentWeekStart}
                    earliestTime={event.earliestTime}
                    latestTime={event.latestTime}
                    autoSave
                    showLegend={false}
                  />
                </div>
              )}

              {method === "pattern" && (
                <div className="p-3">
                  <GeneralAvailabilityEditor
                    patterns={generalAvailability}
                    timezone={timezone}
                    onSave={handleSaveGeneralAvailability}
                    isSaving={isSaving}
                    eventEarliestTime={event.earliestTime}
                    eventLatestTime={event.latestTime}
                  />
                </div>
              )}

              {method === "describe" && (
                <div className="p-3">
                  <AvailabilityAI
                    timezone={timezone}
                    onApply={handleAIApply}
                    currentPatterns={generalAvailability}
                  />
                </div>
              )}
            </div>

            {/* Return CTA */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    All set?
                  </h3>
                  <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                    Head back to see everyone's availability and find the best time
                  </p>
                </div>
                <Link
                  href={`/${event.slug}`}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View Campaign
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
