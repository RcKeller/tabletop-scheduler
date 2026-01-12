"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import Link from "next/link";
import { VirtualizedAvailabilityGrid } from "@/components/availability/VirtualizedAvailabilityGrid";
import { AvailabilityAI } from "@/components/availability/AvailabilityAI";
import { GeneralAvailabilityEditor } from "@/components/availability/GeneralAvailabilityEditor";
import { TimezoneAutocomplete } from "@/components/timezone/TimezoneAutocomplete";
import { CtaBanner } from "@/components/ui/CtaBanner";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import type { TimeSlot, GeneralAvailability as GeneralAvailabilityType } from "@/lib/types";
import { formatTimeDisplay } from "@/lib/utils/gm-availability";
import { expandPatternsToDateRange, slotsToKeySet, keySetToSlots } from "@/lib/utils/availability";
import { addThirtyMinutes } from "@/lib/utils/time-slots";
import { utcToLocal, localToUTC, convertDateTime, getBrowserTimezone } from "@/lib/utils/timezone";

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
  customPreSessionInstructions: string | null;
  gameSystem: { id: string; name: string } | null;
}

interface ParticipantProps {
  id: string;
  displayName: string;
  isGm: boolean;
  hasCharacterInfo: boolean;
}

interface GmAvailabilityBounds {
  earliest: string | null;
  latest: string | null;
  gmTimezone: string | null;
}

interface PlayerAvailabilityPageProps {
  event: EventProps;
  participant: ParticipantProps;
  method: "select" | "pattern" | "describe";
  gmAvailabilityBounds: GmAvailabilityBounds;
}


interface UndoSnapshot {
  effectiveAvailability: TimeSlot[];
  specificAvailability: TimeSlot[];
  generalAvailability: GeneralAvailabilityType[];
  exceptions: Array<{ date: string; startTime: string; endTime: string }>;
  interpretation: string;
  timestamp: number;
}

export function PlayerAvailabilityPage({
  event,
  participant,
  gmAvailabilityBounds,
  // method prop kept for backwards compatibility but no longer used (unified view)
}: PlayerAvailabilityPageProps) {
  const router = useRouter();

  // Persist timezone globally in localStorage
  // Default to event.timezone for SSR, then update client-side
  const [timezone, setTimezoneState] = useState(event.timezone);

  // Load timezone from localStorage on mount, or default to browser timezone
  useEffect(() => {
    const stored = localStorage.getItem("when2play_timezone");
    if (stored) {
      setTimezoneState(stored);
    } else {
      // If no stored timezone, default to browser's local timezone (not event timezone)
      const browserTz = getBrowserTimezone();
      setTimezoneState(browserTz);
      localStorage.setItem("when2play_timezone", browserTz);
    }
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem("when2play_timezone", tz);
  }, []);

  // Convert GM availability bounds from GM's timezone to user's timezone
  const convertedGmBounds = useMemo(() => {
    if (!gmAvailabilityBounds.earliest && !gmAvailabilityBounds.latest) {
      return { earliest: null, latest: null };
    }
    const gmTz = gmAvailabilityBounds.gmTimezone || "UTC";
    // Use today as reference date for timezone conversion
    const refDate = format(new Date(), "yyyy-MM-dd");

    let earliest: string | null = null;
    let latest: string | null = null;

    if (gmAvailabilityBounds.earliest) {
      const converted = convertDateTime(gmAvailabilityBounds.earliest, refDate, gmTz, timezone);
      earliest = converted.time;
    }
    if (gmAvailabilityBounds.latest) {
      const converted = convertDateTime(gmAvailabilityBounds.latest, refDate, gmTz, timezone);
      latest = converted.time;
    }

    return { earliest, latest };
  }, [gmAvailabilityBounds, timezone]);

  const [effectiveAvailability, setEffectiveAvailability] = useState<TimeSlot[]>([]);
  const [specificAvailability, setSpecificAvailability] = useState<TimeSlot[]>([]);
  const [generalAvailability, setGeneralAvailability] = useState<GeneralAvailabilityType[]>([]);
  const [exceptions, setExceptions] = useState<Array<{ date: string; startTime: string; endTime: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [showClearModal, setShowClearModal] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Undo stack for AI changes - stores multiple snapshots
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss undo toasts after 30 seconds
  useEffect(() => {
    if (undoStack.length > 0) {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setUndoStack([]);
      }, 30000);
    }
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, [undoStack]);

  // Always compute a date range - default to today + 3 months if event has no dates
  const eventStartDate = useMemo(() => {
    if (event.startDate) return parseISO(event.startDate);
    return new Date();
  }, [event.startDate]);

  const eventEndDate = useMemo(() => {
    if (event.endDate) return parseISO(event.endDate);
    // Default to 3 months from start
    const end = new Date(eventStartDate);
    end.setMonth(end.getMonth() + 3);
    return end;
  }, [event.endDate, eventStartDate]);

  // String versions for API calls
  const eventStartDateStr = format(eventStartDate, "yyyy-MM-dd");
  const eventEndDateStr = format(eventEndDate, "yyyy-MM-dd");

  // Load existing availability
  const loadAvailability = useCallback(async () => {
    // Only show skeleton on initial load, not on refreshes
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      // ALWAYS send date range - these always have values (either from event or defaults)
      params.set("startDate", eventStartDateStr);
      params.set("endDate", eventEndDateStr);
      if (event.earliestTime) params.set("earliestTime", event.earliestTime);
      if (event.latestTime) params.set("latestTime", event.latestTime);
      // Pass user's timezone so API can convert patterns to UTC
      params.set("timezone", timezone);

      const url = `/api/availability/${participant.id}?${params.toString()}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        console.log("[Frontend] Loaded availability:", {
          effectiveAvailabilityCount: data.effectiveAvailability?.length,
          generalAvailabilityCount: data.generalAvailability?.length,
          firstFewEffective: data.effectiveAvailability?.slice(0, 3),
        });
        setEffectiveAvailability(
          data.effectiveAvailability.map((a: { date: string; startTime: string; endTime: string }) => ({
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
          }))
        );
        setSpecificAvailability(
          data.availability.map((a: { date: string; startTime: string; endTime: string }) => ({
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
          }))
        );
        setGeneralAvailability(data.generalAvailability);
        setExceptions(
          data.exceptions.map((e: { date: string; startTime: string; endTime: string }) => ({
            date: e.date,
            startTime: e.startTime,
            endTime: e.endTime,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  }, [participant.id, eventStartDateStr, eventEndDateStr, event.earliestTime, event.latestTime, timezone]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability, loadKey]);

  // Store participant in localStorage
  useEffect(() => {
    localStorage.setItem(`participant_${event.id}`, participant.id);
  }, [event.id, participant.id]);

  // Auto-save for Select Times with smart diff to preserve interoperability
  const handleAutoSaveAvailability = useCallback(async (slotsInUTC: TimeSlot[]) => {
    setIsSaving(true);
    try {
      // The grid sends slots in UTC. Convert to local timezone for pattern comparison.
      // Pattern keys are in local timezone (user's recurring schedule is timezone-local).
      const slotsInLocal = slotsInUTC.map(slot => {
        const start = utcToLocal(slot.startTime, slot.date, timezone);
        const end = utcToLocal(slot.endTime, slot.date, timezone);
        return {
          date: start.date,
          startTime: start.time,
          endTime: end.time,
        };
      });

      // Convert user's selection to a set (in local timezone)
      const selectedKeys = slotsToKeySet(slotsInLocal);

      // Compute what patterns would produce for the full date range (also in local timezone)
      const patternKeys = expandPatternsToDateRange(
        generalAvailability,
        eventStartDate,
        eventEndDate,
        event.earliestTime,
        event.latestTime
      );

      // Find slots that are selected but NOT from patterns (these are additions)
      const additions = new Set<string>();
      for (const key of selectedKeys) {
        if (!patternKeys.has(key)) {
          additions.add(key);
        }
      }

      // Find slots that are from patterns but NOT selected (these need exceptions)
      const newExceptions: Array<{ date: string; startTime: string; endTime: string }> = [];
      for (const key of patternKeys) {
        if (!selectedKeys.has(key)) {
          const [datePart, time] = key.split("-").reduce(
            (acc, part, i) => {
              if (i < 3) {
                acc[0] = acc[0] ? `${acc[0]}-${part}` : part;
              } else {
                acc[1] = part;
              }
              return acc;
            },
            ["", ""] as [string, string]
          );
          newExceptions.push({
            date: datePart,
            startTime: time,
            endTime: addThirtyMinutes(time),
          });
        }
      }

      // Convert additions from local to UTC for API storage
      const additionsInLocal = keySetToSlots(additions);
      const additionsInUTC = additionsInLocal.map(slot => {
        const start = localToUTC(slot.startTime, slot.date, timezone);
        const end = localToUTC(slot.endTime, slot.date, timezone);
        return {
          date: start.date,
          startTime: start.time,
          endTime: end.time,
        };
      });

      // Convert exceptions from local to UTC for API storage
      const exceptionsInUTC = newExceptions.map(exc => {
        const start = localToUTC(exc.startTime, exc.date, timezone);
        const end = localToUTC(exc.endTime, exc.date, timezone);
        return {
          date: start.date,
          startTime: start.time,
          endTime: end.time,
        };
      });

      // Save to API - all data in UTC, include timezone for storage
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: additionsInUTC,
          exceptions: exceptionsInUTC,
          timezone,
        }),
      });

      if (res.ok) {
        // Store the UTC version for display (grid expects UTC and converts to local)
        setEffectiveAvailability(slotsInUTC);
        setSpecificAvailability(additionsInUTC);
        setExceptions(exceptionsInUTC);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("Failed to save availability:", error);
    } finally {
      setIsSaving(false);
    }
  }, [participant.id, generalAvailability, eventStartDate, eventEndDate, event.earliestTime, event.latestTime, timezone]);

  // Save general availability patterns
  const handleSaveGeneralAvailability = async (patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[]) => {
    console.log("[Frontend] Saving general availability:", { patterns, timezone });
    setIsSaving(true);
    try {
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalAvailability: patterns, timezone }),
      });
      console.log("[Frontend] Save response:", res.ok, res.status);
      if (res.ok) {
        setGeneralAvailability(patterns.map((p, i) => ({
          ...p,
          id: `temp-${i}`,
          participantId: participant.id,
        })));
        console.log("[Frontend] Triggering reload...");
        await new Promise(resolve => setTimeout(resolve, 100));
        setLoadKey((k) => k + 1);
      }
    } catch (error) {
      console.error("Failed to save general availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset - show confirmation modal
  const handleReset = () => {
    setShowClearModal(true);
  };

  // Execute clear after confirmation
  const executeClear = async () => {
    setShowClearModal(false);
    setIsSaving(true);
    try {
      await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: [],
          generalAvailability: [],
          exceptions: [],
          timezone,
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

  // Undo a single AI change from the stack
  const handleAIUndo = useCallback(async (index: number) => {
    const snapshot = undoStack[index];
    if (!snapshot) return;

    setIsSaving(true);
    try {
      // Restore the snapshot
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: snapshot.specificAvailability,
          generalAvailability: snapshot.generalAvailability.map(p => ({
            dayOfWeek: p.dayOfWeek,
            startTime: p.startTime,
            endTime: p.endTime,
          })),
          exceptions: snapshot.exceptions,
          timezone,
        }),
      });

      if (res.ok) {
        setEffectiveAvailability(snapshot.effectiveAvailability);
        setSpecificAvailability(snapshot.specificAvailability);
        setGeneralAvailability(snapshot.generalAvailability);
        setExceptions(snapshot.exceptions);
        // Remove this and all newer items from the stack
        setUndoStack(prev => prev.slice(index + 1));
      }
    } catch (error) {
      console.error("Failed to undo AI changes:", error);
    } finally {
      setIsSaving(false);
    }
  }, [participant.id, undoStack, timezone]);

  // Dismiss a single undo item
  const handleDismissUndo = useCallback((index: number) => {
    setUndoStack(prev => prev.filter((_, i) => i !== index));
  }, []);

  // AI applies patterns, additions, exclusions, and routine removals
  const handleAIApply = useCallback(async (
    patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[],
    additions: Array<{ date: string; startTime: string; endTime: string }>,
    exclusions: Array<{ date: string; startTime?: string; endTime?: string; reason?: string }>,
    routineRemovals: Array<{ dayOfWeek: number; startTime?: string; endTime?: string }>,
    mode: "replace" | "adjust",
    interpretation: string
  ) => {
    // Save snapshot for undo BEFORE applying - push to stack
    const snapshot: UndoSnapshot = {
      effectiveAvailability: [...effectiveAvailability],
      specificAvailability: [...specificAvailability],
      generalAvailability: [...generalAvailability],
      exceptions: [...exceptions],
      interpretation,
      timestamp: Date.now(),
    };

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { timezone };

      // Start with current patterns for merging
      let updatedPatterns: Omit<GeneralAvailabilityType, "id" | "participantId">[] =
        mode === "replace" ? [] : generalAvailability.map(p => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          isAvailable: p.isAvailable,
        }));

      // Apply routine removals - create "Not Available" patterns for blocked times
      // These will trump any "Available" patterns for the same day/time
      if (routineRemovals.length > 0) {
        for (const removal of routineRemovals) {
          // First, remove any existing "Not Available" pattern for this day to avoid duplicates
          updatedPatterns = updatedPatterns.filter(p => {
            if (p.dayOfWeek !== removal.dayOfWeek) return true;
            if (p.isAvailable !== false) return true; // Keep available patterns for now
            // Remove matching unavailable patterns
            if (!removal.startTime || !removal.endTime) {
              return false; // Remove all unavailable for this day
            }
            // Check for overlap - remove if overlapping
            return removal.endTime <= p.startTime || removal.startTime >= p.endTime;
          });

          // Add a "Not Available" pattern for this removal
          if (!removal.startTime || !removal.endTime) {
            // Entire day is not available
            updatedPatterns.push({
              dayOfWeek: removal.dayOfWeek,
              startTime: "00:00",
              endTime: "23:59",
              isAvailable: false,
            });
          } else {
            // Specific time range is not available
            updatedPatterns.push({
              dayOfWeek: removal.dayOfWeek,
              startTime: removal.startTime,
              endTime: removal.endTime,
              isAvailable: false,
            });
          }
        }
        body.generalAvailability = updatedPatterns;
        body.clearSpecificOnPatternSave = false;
      }

      // Apply new patterns (add/replace)
      if (patterns.length > 0) {
        if (mode === "replace") {
          body.generalAvailability = patterns;
        } else {
          // Merge with existing (or already-modified) patterns
          const basePatterns = body.generalAvailability as typeof updatedPatterns || updatedPatterns;
          const mergedPatterns: Omit<GeneralAvailabilityType, "id" | "participantId">[] = [];
          const daysWithNewPatterns = new Set(patterns.map(p => p.dayOfWeek));

          for (const p of basePatterns) {
            if (!daysWithNewPatterns.has(p.dayOfWeek)) {
              mergedPatterns.push(p);
            }
          }

          for (const p of patterns) {
            mergedPatterns.push(p);
          }

          body.generalAvailability = mergedPatterns;
          body.clearSpecificOnPatternSave = false;
        }
      }

      // Apply specific date additions - convert from local to UTC
      if (additions.length > 0) {
        // Convert additions from local timezone to UTC for storage
        const additionsInUTC = additions.map(slot => {
          const start = localToUTC(slot.startTime, slot.date, timezone);
          const end = localToUTC(slot.endTime, slot.date, timezone);
          return {
            date: start.date,
            startTime: start.time,
            endTime: end.time,
          };
        });

        if (mode === "adjust") {
          // effectiveAvailability is already in UTC
          const existingSlots = new Set(
            effectiveAvailability.map(s => `${s.date}|${s.startTime}|${s.endTime}`)
          );
          const newSlots = [
            ...effectiveAvailability,
            ...additionsInUTC.filter(a => !existingSlots.has(`${a.date}|${a.startTime}|${a.endTime}`))
          ];
          body.availability = newSlots;
        } else {
          body.availability = additionsInUTC;
        }
      }

      // Apply exclusions (specific date exceptions) - convert from local to UTC
      if (exclusions.length > 0) {
        const exceptionsInUTC = exclusions.map(exc => {
          const startTime = exc.startTime || "00:00";
          const endTime = exc.endTime || "23:59";
          const start = localToUTC(startTime, exc.date, timezone);
          const end = localToUTC(endTime, exc.date, timezone);
          return {
            date: start.date,
            startTime: start.time,
            endTime: end.time,
            reason: exc.reason,
          };
        });
        body.exceptions = exceptionsInUTC;
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
          // Add to undo stack AFTER successful save
          setUndoStack(prev => [snapshot, ...prev].slice(0, 10)); // Keep max 10 undo items

          // Reload to get updated effective availability
          await new Promise(resolve => setTimeout(resolve, 100));
          setLoadKey((k) => k + 1);
        }
      }
    } catch (error) {
      console.error("Failed to apply AI changes:", error);
    } finally {
      setIsSaving(false);
    }
  }, [effectiveAvailability, specificAvailability, generalAvailability, exceptions, participant.id, timezone]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl px-3 py-2 sm:px-4">
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
                  {participant.displayName}&apos;s Availability
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving...</span>
              )}
              <TimezoneAutocomplete value={timezone} onChange={setTimezone} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "300px" }} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* GM Availability Bounds Callout - only for non-GM players */}
            {!participant.isGm && (convertedGmBounds.earliest || convertedGmBounds.latest) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    GM is available between{" "}
                    <strong>{convertedGmBounds.earliest ? formatTimeDisplay(convertedGmBounds.earliest) : "—"}</strong>
                    {" "}and{" "}
                    <strong>{convertedGmBounds.latest ? formatTimeDisplay(convertedGmBounds.latest) : "—"}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Calendar Card - Shows ALL availability (24hr view) */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Your Availability
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Click and drag to select when you&apos;re free. This shows all your availability including recurring patterns.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Clear All
                </button>
              </div>
              <div className="p-2 sm:p-3">
                <VirtualizedAvailabilityGrid
                  key={`grid-${timezone}`}
                  startDate={eventStartDate}
                  endDate={eventEndDate}
                  earliestTime={!participant.isGm && convertedGmBounds.earliest ? convertedGmBounds.earliest : "00:00"}
                  latestTime={!participant.isGm && convertedGmBounds.latest ? convertedGmBounds.latest : "23:30"}
                  mode="edit"
                  availability={effectiveAvailability}
                  onSave={handleAutoSaveAvailability}
                  isSaving={isSaving}
                  autoSave
                  timezone={timezone}
                />
              </div>
            </div>

            {/* Recurring Patterns Card - Full width */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Recurring Schedule
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Set your typical weekly availability — mark times as available or blocked
                </p>
              </div>
              <div className="p-3">
                <GeneralAvailabilityEditor
                  patterns={generalAvailability}
                  timezone={timezone}
                  onSave={handleSaveGeneralAvailability}
                  isSaving={isSaving}
                  eventEarliestTime={!participant.isGm && convertedGmBounds.earliest ? convertedGmBounds.earliest : "00:00"}
                  eventLatestTime={!participant.isGm && convertedGmBounds.latest ? convertedGmBounds.latest : "23:30"}
                />
              </div>
            </div>

            {/* AI Assistant Card */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI Assistant
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Describe your availability in plain English
                </p>
              </div>
              <div className="p-3">
                <AvailabilityAI
                  timezone={timezone}
                  onApply={handleAIApply}
                  currentPatterns={generalAvailability}
                />
              </div>
            </div>

            {/* Spacer for fixed CTA banner */}
            {effectiveAvailability.length > 0 && (
              <div className="h-16" />
            )}
          </div>
        )}
      </main>

      {/* Fixed CTA Banner */}
      {effectiveAvailability.length > 0 && (
        event.customPreSessionInstructions && !participant.hasCharacterInfo ? (
          <CtaBanner
            message="One more step: Set up your character"
            actionLabel="Set Up Character"
            actionHref={`/${event.slug}/${encodeURIComponent(participant.displayName.toLowerCase().replace(/\s+/g, "-"))}/character`}
            secondaryActionLabel="Skip"
            secondaryActionHref={`/${event.slug}`}
            variant="info"
          />
        ) : (
          <CtaBanner
            message="All set! Head back to see everyone's availability"
            actionLabel="View Campaign"
            actionHref={`/${event.slug}`}
            variant="success"
          />
        )
      )}

      {/* Clear Availability Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={executeClear}
        title="Clear Availability"
        message="Are you sure you want to clear all your availability? This cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
      />

      {/* Fixed position undo toast stack - above CTA banner */}
      {undoStack.length > 0 && (
        <div className={`fixed right-4 z-50 flex flex-col gap-2 max-w-sm ${effectiveAvailability.length > 0 ? "bottom-20" : "bottom-4"}`}>
          {undoStack.map((item, index) => (
            <div
              key={item.timestamp}
              className="rounded-lg border border-green-200 bg-white p-3 shadow-lg dark:border-green-800 dark:bg-zinc-900"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Updated
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {item.interpretation}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleAIUndo(index)}
                    disabled={isSaving}
                    className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 disabled:opacity-50"
                  >
                    Undo
                  </button>
                  <button
                    onClick={() => handleDismissUndo(index)}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
