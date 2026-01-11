"use client";

import { useState, useEffect, useCallback } from "react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AvailabilityAI } from "./AvailabilityAI";
import { GeneralAvailabilityEditor } from "./GeneralAvailabilityEditor";
import type { TimeSlot, GeneralAvailability as GeneralAvailabilityType } from "@/lib/types";

interface Participant {
  id: string;
  displayName: string;
  isGm: boolean;
}

interface AvailabilitySectionProps {
  participant: Participant;
  timezone: string;
  onUpdate: () => void;
  weekStart?: Date;
  earliestTime?: string;
  latestTime?: string;
  eventStartDate?: string;
  eventEndDate?: string;
}

type Tab = "specific" | "general" | "ai";

export function AvailabilitySection({
  participant,
  timezone,
  onUpdate,
  weekStart,
  earliestTime,
  latestTime,
  eventStartDate,
  eventEndDate,
}: AvailabilitySectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>("specific");
  const [effectiveAvailability, setEffectiveAvailability] = useState<TimeSlot[]>([]);
  const [generalAvailability, setGeneralAvailability] = useState<GeneralAvailabilityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loadKey, setLoadKey] = useState(0); // Force reload

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load existing availability
  const loadAvailability = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventStartDate) params.set("startDate", eventStartDate);
      if (eventEndDate) params.set("endDate", eventEndDate);
      if (earliestTime) params.set("earliestTime", earliestTime);
      if (latestTime) params.set("latestTime", latestTime);

      const url = `/api/availability/${participant.id}${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        // Use effectiveAvailability which combines patterns + specific slots - exceptions
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
  }, [participant.id, eventStartDate, eventEndDate, earliestTime, latestTime]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability, loadKey]);

  // Save specific availability (from grid)
  const handleSaveAvailability = async (slots: TimeSlot[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/availability/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: slots }),
      });
      if (res.ok) {
        setEffectiveAvailability(slots);
        // Small delay to ensure database commit before heatmap refresh
        await new Promise(resolve => setTimeout(resolve, 100));
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to save availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

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
        // Small delay to ensure database commit before refresh
        await new Promise(resolve => setTimeout(resolve, 100));
        // Reload to get new effective availability
        setLoadKey((k) => k + 1);
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to save general availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // AI applies patterns, additions, exclusions, and routine removals
  const handleAIApply = async (
    patterns: Omit<GeneralAvailabilityType, "id" | "participantId">[],
    additions: Array<{ date: string; startTime: string; endTime: string }>,
    exclusions: Array<{ date: string; startTime?: string; endTime?: string; reason?: string }>,
    routineRemovals: Array<{ dayOfWeek: number; startTime?: string; endTime?: string }>,
    mode: "replace" | "adjust",
    _interpretation?: string // Unused but kept for type compatibility with AvailabilityAI
  ) => {
    setIsSaving(true);
    try {
      // Build the request body based on mode and what was provided
      const body: Record<string, unknown> = {};

      // Start with current patterns for merging
      let updatedPatterns: Omit<GeneralAvailabilityType, "id" | "participantId">[] =
        mode === "replace" ? [] : generalAvailability.map(p => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          isAvailable: p.isAvailable,
        }));

      // Apply routine removals first (remove days/times from routine)
      if (routineRemovals.length > 0) {
        for (const removal of routineRemovals) {
          if (!removal.startTime || !removal.endTime) {
            // Remove entire day
            updatedPatterns = updatedPatterns.filter(p => p.dayOfWeek !== removal.dayOfWeek);
          } else {
            // Remove specific time range from that day
            updatedPatterns = updatedPatterns.flatMap(p => {
              if (p.dayOfWeek !== removal.dayOfWeek) return [p];

              // Check if removal overlaps with this pattern
              if (removal.endTime! <= p.startTime || removal.startTime! >= p.endTime) {
                return [p];
              }

              const result: typeof updatedPatterns = [];

              if (p.startTime < removal.startTime!) {
                result.push({
                  dayOfWeek: p.dayOfWeek,
                  startTime: p.startTime,
                  endTime: removal.startTime!,
                  isAvailable: p.isAvailable,
                });
              }

              if (p.endTime > removal.endTime!) {
                result.push({
                  dayOfWeek: p.dayOfWeek,
                  startTime: removal.endTime!,
                  endTime: p.endTime,
                  isAvailable: p.isAvailable,
                });
              }

              return result;
            });
          }
        }
        body.generalAvailability = updatedPatterns;
        body.clearSpecificOnPatternSave = false;
      }

      // Handle patterns (weekly schedule)
      if (patterns.length > 0) {
        if (mode === "replace") {
          // Replace mode: set new patterns entirely
          body.generalAvailability = patterns;
        } else {
          // Adjust mode: MERGE with existing (or already-modified) patterns
          const basePatterns = body.generalAvailability as typeof updatedPatterns || updatedPatterns;
          const mergedPatterns: Omit<GeneralAvailabilityType, "id" | "participantId">[] = [];
          const daysWithNewPatterns = new Set(patterns.map(p => p.dayOfWeek));

          // Keep existing patterns for days not being updated
          for (const p of basePatterns) {
            if (!daysWithNewPatterns.has(p.dayOfWeek)) {
              mergedPatterns.push(p);
            }
          }

          // Add all new patterns
          for (const p of patterns) {
            mergedPatterns.push(p);
          }

          body.generalAvailability = mergedPatterns;
          body.clearSpecificOnPatternSave = false;
        }
      }

      // Handle specific date additions
      if (additions.length > 0) {
        // In adjust mode, we need to ADD to existing availability, not replace
        if (mode === "adjust") {
          // Merge with current effective availability
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

      // Handle exclusions (times NOT available)
      if (exclusions.length > 0) {
        // Convert exclusions to exception format
        const exceptions = exclusions.map(exc => ({
          date: exc.date,
          startTime: exc.startTime || "00:00",
          endTime: exc.endTime || "23:59",
          reason: exc.reason,
        }));
        body.exceptions = exceptions;
        // In adjust mode, append to existing exceptions rather than replacing
        if (mode === "adjust") {
          body.appendExceptions = true;
        }
      }

      // Make the API call
      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/availability/${participant.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          // Small delay to ensure database commit before refresh
          await new Promise(resolve => setTimeout(resolve, 100));

          // Reload to get updated effective availability
          setLoadKey((k) => k + 1);

          // Trigger heatmap refresh
          onUpdate();

          // Switch to appropriate tab based on what was changed
          if (patterns.length > 0) {
            setActiveTab("general");
          } else if (additions.length > 0 && !isMobile) {
            setActiveTab("specific");
          }
        }
      }
    } catch (error) {
      console.error("Failed to apply AI changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading availability...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync indicator */}
      <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          All methods below update the same availability. Changes appear in the group heatmap.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {!isMobile && (
          <button
            onClick={() => setActiveTab("specific")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "specific"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Select Times
          </button>
        )}
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "general"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Weekly Pattern
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "ai"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Describe in Text
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === "specific" && !isMobile && (
          <AvailabilityGrid
            availability={effectiveAvailability}
            timezone={timezone}
            onSave={handleSaveAvailability}
            isSaving={isSaving}
            weekStart={weekStart}
            earliestTime={earliestTime}
            latestTime={latestTime}
          />
        )}

        {activeTab === "specific" && isMobile && (
          <div className="rounded-md bg-zinc-100 p-4 text-center text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <p className="mb-2">Grid selection works best on larger screens.</p>
            <p>Use the <strong>Weekly Pattern</strong> or <strong>Describe in Text</strong> tab on mobile.</p>
          </div>
        )}

        {activeTab === "general" && (
          <GeneralAvailabilityEditor
            patterns={generalAvailability}
            timezone={timezone}
            onSave={handleSaveGeneralAvailability}
            isSaving={isSaving}
          />
        )}

        {activeTab === "ai" && (
          <AvailabilityAI
            timezone={timezone}
            onApply={handleAIApply}
            currentPatterns={generalAvailability}
          />
        )}
      </div>
    </div>
  );
}
