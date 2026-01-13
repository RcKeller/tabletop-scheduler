"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { VirtualizedAvailabilityGrid } from "./VirtualizedAvailabilityGrid";
import { useTimezoneWithFallback } from "./TimezoneContext";
import { useAvailabilityRules } from "@/lib/hooks/useAvailabilityRules";
import {
  computeEffectiveRanges,
  minutesToTime,
  prepareRuleForStorage,
  type AvailabilityRule,
  type CreateAvailabilityRuleInput,
  type DateRange,
} from "@/lib/availability";
import type { TimeSlot } from "@/lib/types";

interface AvailabilityEditorProps {
  participantId: string;
  event: {
    title: string;
    timezone: string;
    startDate: string;
    endDate: string;
    earliestTime: string;
    latestTime: string;
  };
  isGm?: boolean;
  initialRules?: AvailabilityRule[];
  onSaveComplete?: () => void;
}

// Day configuration
const DAYS = [
  { value: 0, label: "Sunday", short: "Su" },
  { value: 1, label: "Monday", short: "Mo" },
  { value: 2, label: "Tuesday", short: "Tu" },
  { value: 3, label: "Wednesday", short: "We" },
  { value: 4, label: "Thursday", short: "Th" },
  { value: 5, label: "Friday", short: "Fr" },
  { value: 6, label: "Saturday", short: "Sa" },
];

const DAY_PRESETS = [
  { value: "weekdays", label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { value: "weekends", label: "Weekends", days: [0, 6] },
];

// Time options
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  const display = `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  return { value: time, label: display };
});

interface PatternEntry {
  id: string;
  days: number[];
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

// Convert AvailabilityRule[] to TimeSlot[] for the grid
function rulesToTimeSlots(
  rules: AvailabilityRule[],
  dateRange: DateRange
): TimeSlot[] {
  const effectiveRanges = computeEffectiveRanges(rules, dateRange);
  const slots: TimeSlot[] = [];

  for (const [date, dayAvail] of effectiveRanges) {
    for (const range of dayAvail.availableRanges) {
      slots.push({
        date,
        startTime: minutesToTime(range.startMinutes),
        endTime: minutesToTime(range.endMinutes),
      });
    }
  }

  return slots;
}

// Convert TimeSlot[] to CreateAvailabilityRuleInput[] (as override rules)
function timeSlotsToRules(
  slots: TimeSlot[],
  participantId: string,
  timezone: string
): CreateAvailabilityRuleInput[] {
  const rules: CreateAvailabilityRuleInput[] = [];

  for (const slot of slots) {
    const prepared = prepareRuleForStorage(
      {
        ruleType: "available_override",
        specificDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
      timezone
    );

    rules.push({
      participantId,
      ruleType: "available_override",
      dayOfWeek: null,
      specificDate: prepared.specificDate,
      startTime: prepared.startTime,
      endTime: prepared.endTime,
      originalTimezone: prepared.originalTimezone,
      originalDayOfWeek: null,
      source: "manual",
    });
  }

  return rules;
}

// Extract pattern rules from AvailabilityRule[]
function extractPatternEntries(rules: AvailabilityRule[]): PatternEntry[] {
  const patternRules = rules.filter(
    (r) => r.ruleType === "available_pattern" || r.ruleType === "blocked_pattern"
  );

  const groups = new Map<string, PatternEntry>();

  for (const rule of patternRules) {
    if (rule.dayOfWeek === null) continue;

    const isAvailable = rule.ruleType === "available_pattern";
    const key = `${rule.startTime}-${rule.endTime}-${isAvailable}`;
    const existing = groups.get(key);

    if (existing) {
      if (!existing.days.includes(rule.dayOfWeek)) {
        existing.days.push(rule.dayOfWeek);
        existing.days.sort((a, b) => a - b);
      }
    } else {
      groups.set(key, {
        id: `pattern-${rule.id}`,
        days: [rule.dayOfWeek],
        startTime: rule.startTime,
        endTime: rule.endTime,
        isAvailable,
      });
    }
  }

  return Array.from(groups.values());
}

// Convert PatternEntry[] to CreateAvailabilityRuleInput[]
function patternEntriesToRules(
  entries: PatternEntry[],
  participantId: string,
  timezone: string
): CreateAvailabilityRuleInput[] {
  const rules: CreateAvailabilityRuleInput[] = [];

  for (const entry of entries) {
    for (const dayOfWeek of entry.days) {
      const ruleType = entry.isAvailable ? "available_pattern" : "blocked_pattern";
      const prepared = prepareRuleForStorage(
        {
          ruleType,
          dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
        },
        timezone
      );

      rules.push({
        participantId,
        ruleType,
        dayOfWeek: prepared.dayOfWeek ?? dayOfWeek,
        specificDate: null,
        startTime: prepared.startTime,
        endTime: prepared.endTime,
        originalTimezone: prepared.originalTimezone,
        originalDayOfWeek: dayOfWeek,
        source: "manual",
      });
    }
  }

  return rules;
}

export function AvailabilityEditor({
  participantId,
  event,
  isGm = false,
  initialRules,
  onSaveComplete,
}: AvailabilityEditorProps) {
  const { timezone, setTimezone, commonTimezones } = useTimezoneWithFallback();

  const {
    rules,
    isLoading,
    error,
    replaceRules,
    addRules,
    setLocalRules,
  } = useAvailabilityRules({
    participantId,
    fetchOnMount: !initialRules,
  });

  // Use initial rules if provided, otherwise fetched rules
  const effectiveRules = initialRules || rules;

  // Pattern editor state
  const [patternEntries, setPatternEntries] = useState<PatternEntry[]>([]);
  const [hasPatternChanges, setHasPatternChanges] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // AI input state
  const [aiInput, setAiInput] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Track if we've initialized patterns
  const patternsInitialized = useRef(false);

  // Date range for the grid
  const dateRange: DateRange = useMemo(
    () => ({
      startDate: event.startDate,
      endDate: event.endDate,
    }),
    [event.startDate, event.endDate]
  );

  // Convert rules to TimeSlots for VirtualizedAvailabilityGrid
  const timeSlots = useMemo(() => {
    return rulesToTimeSlots(effectiveRules, dateRange);
  }, [effectiveRules, dateRange]);

  // Initialize pattern entries from rules (only once)
  useEffect(() => {
    if (!patternsInitialized.current && effectiveRules.length > 0) {
      setPatternEntries(extractPatternEntries(effectiveRules));
      patternsInitialized.current = true;
    }
  }, [effectiveRules]);

  // Handle grid save - optimistic, skip refetch to avoid flashing
  const handleGridSave = useCallback(
    async (slots: TimeSlot[]) => {
      setSaveStatus("saving");

      // Keep existing pattern rules
      const patternRules = patternEntriesToRules(patternEntries, participantId, timezone);

      // Convert new slots to override rules
      const overrideRules = timeSlotsToRules(slots, participantId, timezone);

      // Combine all rules
      const allRules = [...patternRules, ...overrideRules];

      try {
        // Pass skipRefetch=true to avoid re-rendering the grid
        const success = await replaceRules(allRules, true);
        if (success) {
          setSaveStatus("saved");
          onSaveComplete?.();
          setTimeout(() => setSaveStatus("idle"), 1500);
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [patternEntries, participantId, timezone, replaceRules, onSaveComplete]
  );

  // Pattern editor handlers
  const addPatternEntry = useCallback((days: number[], isAvailable: boolean = true) => {
    const newEntry: PatternEntry = {
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      days,
      startTime: "17:00",
      endTime: "21:00",
      isAvailable,
    };
    setPatternEntries((prev) => [...prev, newEntry]);
    setHasPatternChanges(true);
    setShowAddMenu(false);
  }, []);

  const removePatternEntry = useCallback((id: string) => {
    setPatternEntries((prev) => prev.filter((e) => e.id !== id));
    setHasPatternChanges(true);
  }, []);

  const togglePatternDay = useCallback((entryId: string, dayValue: number) => {
    setPatternEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const hasDay = e.days.includes(dayValue);
        let newDays: number[];
        if (hasDay) {
          newDays = e.days.filter((d) => d !== dayValue);
          if (newDays.length === 0) return e;
        } else {
          newDays = [...e.days, dayValue].sort((a, b) => a - b);
        }
        return { ...e, days: newDays };
      })
    );
    setHasPatternChanges(true);
  }, []);

  const updatePatternEntry = useCallback(
    (id: string, field: "startTime" | "endTime", value: string) => {
      setPatternEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
      );
      setHasPatternChanges(true);
    },
    []
  );

  const togglePatternAvailability = useCallback((id: string) => {
    setPatternEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isAvailable: !e.isAvailable } : e))
    );
    setHasPatternChanges(true);
  }, []);

  const savePatterns = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus("saving");
    try {
      // Keep existing override rules
      const overrideRules = effectiveRules
        .filter((r) => r.ruleType === "available_override" || r.ruleType === "blocked_override")
        .map((r) => ({
          participantId: r.participantId,
          ruleType: r.ruleType,
          dayOfWeek: r.dayOfWeek,
          specificDate: r.specificDate,
          startTime: r.startTime,
          endTime: r.endTime,
          originalTimezone: r.originalTimezone,
          originalDayOfWeek: r.originalDayOfWeek,
          source: r.source,
        }));

      // Convert pattern entries to rules
      const patternRules = patternEntriesToRules(patternEntries, participantId, timezone);

      const success = await replaceRules([...patternRules, ...overrideRules]);
      if (success) {
        setHasPatternChanges(false);
        setSaveStatus("saved");
        onSaveComplete?.();
        setTimeout(() => setSaveStatus("idle"), 1500);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [effectiveRules, patternEntries, participantId, timezone, replaceRules, onSaveComplete]);

  // Handle AI input
  const handleAIParse = useCallback(async () => {
    if (!aiInput.trim()) return;

    setIsParsingAI(true);
    setAiError(null);

    try {
      const today = new Date().toISOString().split("T")[0];

      const response = await fetch("/api/availability/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiInput,
          timezone,
          participantId,
          currentDate: today,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse availability");
      }

      const result = await response.json();

      if (result.rules && result.rules.length > 0) {
        const success = await addRules(result.rules);
        if (success) {
          setAiInput("");
          // Re-initialize patterns from the updated rules
          patternsInitialized.current = false;
        }
      }
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Failed to parse availability"
      );
    } finally {
      setIsParsingAI(false);
    }
  }, [aiInput, timezone, participantId, addRules]);

  const formatDaysLabel = (days: number[]) => {
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) {
      return "Weekdays";
    }
    if (days.length === 2 && days.includes(0) && days.includes(6)) {
      return "Weekends";
    }
    if (days.length === 7) {
      return "Every day";
    }
    return days.map((d) => DAYS[d].short).join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {isGm ? "GM Availability" : "Your Availability"}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isGm
              ? "Set when you can run sessions"
              : "Let the GM know when you can play"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Save status indicator */}
          {saveStatus !== "idle" && (
            <span className={`text-sm ${
              saveStatus === "saving" ? "text-blue-600" :
              saveStatus === "saved" ? "text-green-600" :
              "text-red-600"
            }`}>
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "saved" && "Saved!"}
              {saveStatus === "error" && "Error saving"}
            </span>
          )}

          {/* Timezone selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Timezone:</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
            >
              {commonTimezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* AI Input */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Describe your availability in plain English
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="e.g., free weekday evenings 6-10pm, busy on Mondays"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAIParse();
              }
            }}
          />
          <button
            onClick={handleAIParse}
            disabled={isParsingAI || !aiInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsingAI ? "Processing..." : "Add"}
          </button>
        </div>
        {aiError && <p className="mt-2 text-sm text-red-600">{aiError}</p>}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500">
          Loading availability...
        </div>
      )}

      {/* Main Content - Pattern Editor and Grid */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Recurring Schedule Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Recurring Schedule</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Set your typical weekly availability</p>
              </div>
              {hasPatternChanges && (
                <button
                  onClick={savePatterns}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Schedule"}
                </button>
              )}
            </div>

            {/* Pattern entries */}
            {patternEntries.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-3">
                No recurring schedule set. Add one below or use the calendar.
              </p>
            ) : (
              <div className="space-y-2 mb-3">
                {patternEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 p-2 rounded-lg border ${
                      entry.isAvailable
                        ? "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20"
                        : "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
                    }`}
                  >
                    <button
                      onClick={() => togglePatternAvailability(entry.id)}
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        entry.isAvailable
                          ? "bg-green-500 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {entry.isAvailable ? "Available" : "Blocked"}
                    </button>

                    <div className="flex flex-wrap gap-1">
                      {DAYS.map((day) => {
                        const isSelected = entry.days.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            onClick={() => togglePatternDay(entry.id, day.value)}
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              isSelected
                                ? entry.isAvailable
                                  ? "bg-green-600 text-white"
                                  : "bg-red-600 text-white"
                                : "bg-gray-100 text-gray-400 dark:bg-gray-700"
                            }`}
                          >
                            {day.short}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1 text-sm">
                      <select
                        value={entry.startTime}
                        onChange={(e) => updatePatternEntry(entry.id, "startTime", e.target.value)}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-xs"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <span className="text-gray-400">-</span>
                      <select
                        value={entry.endTime}
                        onChange={(e) => updatePatternEntry(entry.id, "endTime", e.target.value)}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-xs"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => removePatternEntry(entry.id)}
                      className="ml-auto text-gray-400 hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add pattern buttons */}
            <div className="relative inline-block">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add recurring time
              </button>

              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-xl">
                    <div className="px-3 py-1 text-xs font-semibold uppercase text-gray-400">Available</div>
                    {DAY_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => addPatternEntry(preset.days, true)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <span>{preset.label}</span>
                        <span className="text-xs text-green-600">available</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    <div className="px-3 py-1 text-xs font-semibold uppercase text-gray-400">Blocked</div>
                    {DAY_PRESETS.map((preset) => (
                      <button
                        key={`blocked-${preset.value}`}
                        onClick={() => addPatternEntry(preset.days, false)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <span>{preset.label}</span>
                        <span className="text-xs text-red-600">blocked</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Calendar Grid Section */}
          <div>
            <div className="mb-3">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Calendar</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Click and drag to add or remove specific dates. Changes save automatically.
              </p>
            </div>

            <VirtualizedAvailabilityGrid
              startDate={new Date(event.startDate)}
              endDate={new Date(event.endDate)}
              earliestTime="00:00"
              latestTime="23:30"
              mode="edit"
              availability={timeSlots}
              onSave={handleGridSave}
              autoSave={true}
              timezone={timezone}
            />
          </div>
        </div>
      )}
    </div>
  );
}
