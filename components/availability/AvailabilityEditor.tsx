"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { VirtualizedAvailabilityGrid } from "./VirtualizedAvailabilityGrid";
import { useAvailabilityRules } from "@/lib/hooks/useAvailabilityRules";
import { useTimezone } from "@/components/layout/TimezoneProvider";
import {
  computeEffectiveRanges,
  minutesToTime,
  prepareRuleForStorage,
  convertPatternFromUTC,
  convertPatternBetweenTimezones,
  type AvailabilityRule,
  type CreateAvailabilityRuleInput,
  type DateRange,
} from "@/lib/availability";
import { GmCompleteCta, PlayerCompleteCta } from "@/components/ui/FloatingGlassCta";
import type { TimeSlot } from "@/lib/types";

interface AvailabilityEditorProps {
  participantId: string;
  event: {
    slug?: string;
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
  hasCharacter?: boolean;
  gmAvailability?: TimeSlot[];  // GM's availability for visual indication on player grids (in UTC)
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
  { value: "everyday", label: "Every Day", days: [0, 1, 2, 3, 4, 5, 6] },
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
// NOTE: Rules are stored in UTC. When displaying in a local timezone, we need
// to compute a wider UTC range to capture times that appear on different days.
// For example, "Monday 5pm Pacific" is "Tuesday 1am UTC", so we need to include
// Tuesday UTC to show Monday evening in Pacific.
function rulesToTimeSlots(
  rules: AvailabilityRule[],
  dateRange: DateRange
): TimeSlot[] {
  // Expand the date range by 1 day on each end to handle timezone shifts
  // A local day might need UTC data from the day before (eastern TZ) or after (western TZ)
  const expandedStart = new Date(dateRange.startDate + "T12:00:00Z");
  expandedStart.setUTCDate(expandedStart.getUTCDate() - 1);
  const expandedEnd = new Date(dateRange.endDate + "T12:00:00Z");
  expandedEnd.setUTCDate(expandedEnd.getUTCDate() + 1);

  const expandedRange: DateRange = {
    startDate: expandedStart.toISOString().split("T")[0],
    endDate: expandedEnd.toISOString().split("T")[0],
  };

  const effectiveRanges = computeEffectiveRanges(rules, expandedRange);
  const slots: TimeSlot[] = [];

  for (const [date, dayAvail] of effectiveRanges) {
    for (const range of dayAvail.availableRanges) {
      // Handle overnight ranges (endMinutes >= 1440)
      if (range.endMinutes >= 1440) {
        // Split into two slots: one ending at midnight, one starting at midnight next day
        // First part: startTime to midnight (24:00 represents end of day)
        slots.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: "24:00", // Special value meaning "end of this day" (midnight)
        });
        // Second part: 00:00 to endTime on next day
        const nextDate = new Date(date + "T12:00:00Z");
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const nextDateStr = nextDate.toISOString().split("T")[0];
        const wrappedEnd = range.endMinutes - 1440;
        if (wrappedEnd > 0) {
          slots.push({
            date: nextDateStr,
            startTime: "00:00",
            endTime: minutesToTime(wrappedEnd),
          });
        }
      } else {
        slots.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: minutesToTime(range.endMinutes),
        });
      }
    }
  }

  return slots;
}

// Convert TimeSlot[] to CreateAvailabilityRuleInput[] (as override rules)
// If alreadyUTC is true, slots are already in UTC and should not be converted
function timeSlotsToRules(
  slots: TimeSlot[],
  participantId: string,
  timezone: string,
  alreadyUTC: boolean = false
): CreateAvailabilityRuleInput[] {
  const rules: CreateAvailabilityRuleInput[] = [];

  for (const slot of slots) {
    if (alreadyUTC) {
      // Slots are already in UTC (e.g., from grid save) - use directly
      rules.push({
        participantId,
        ruleType: "available_override",
        dayOfWeek: null,
        specificDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        originalTimezone: timezone,
        originalDayOfWeek: null,
        source: "manual",
      });
    } else {
      // Slots are in local timezone - convert to UTC
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
  }

  return rules;
}

// Extract pattern rules from AvailabilityRule[] and convert from UTC to display timezone
function extractPatternEntries(
  rules: AvailabilityRule[],
  displayTimezone: string
): PatternEntry[] {
  const patternRules = rules.filter(
    (r) => r.ruleType === "available_pattern" || r.ruleType === "blocked_pattern"
  );

  const groups = new Map<string, PatternEntry>();

  for (const rule of patternRules) {
    if (rule.dayOfWeek === null) continue;

    // Convert from UTC to display timezone
    const converted = convertPatternFromUTC(
      rule.dayOfWeek,
      rule.startTime,
      rule.endTime,
      displayTimezone
    );

    const isAvailable = rule.ruleType === "available_pattern";
    // Group by DISPLAY timezone times, not UTC
    const key = `${converted.startTime}-${converted.endTime}-${isAvailable}`;
    const existing = groups.get(key);

    if (existing) {
      if (!existing.days.includes(converted.dayOfWeek)) {
        existing.days.push(converted.dayOfWeek);
        existing.days.sort((a, b) => a - b);
      }
    } else {
      groups.set(key, {
        id: `pattern-${rule.id}`,
        days: [converted.dayOfWeek],
        startTime: converted.startTime,
        endTime: converted.endTime,
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
        crossesMidnight: prepared.crossesMidnight, // CRITICAL: Pass through for full-day patterns
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
  hasCharacter = false,
  gmAvailability = [],
}: AvailabilityEditorProps) {
  // Use shared timezone from context (managed by navbar)
  const { timezone } = useTimezone();

  const {
    rules,
    isLoading,
    error,
    replaceRules,
  } = useAvailabilityRules({
    participantId,
    fetchOnMount: !initialRules,
  });

  // Use initial rules if provided, otherwise fetched rules
  const effectiveRules = initialRules || rules;

  // Pattern editor state
  const [patternEntries, setPatternEntries] = useState<PatternEntry[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // CTA state - persistent once saved, with timestamp
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Track current grid slots locally to avoid losing overrides when patterns are saved
  // This is updated when the grid saves, and used when patterns are saved
  const [localOverrideSlots, setLocalOverrideSlots] = useState<TimeSlot[]>([]);
  // Lightweight flag for UI (Clear All button visibility) - avoids expensive recomputes
  const [hasGridSlots, setHasGridSlots] = useState(false);

  // Refs for latest state (to avoid stale closures in debounced saves)
  const patternEntriesRef = useRef<PatternEntry[]>(patternEntries);
  const localOverrideSlotsRef = useRef<TimeSlot[]>(localOverrideSlots);

  // Track if we're in a user-initiated edit (to prevent useEffect from overwriting)
  const isUserEditingRef = useRef(false);
  const userEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // AI input state
  const [aiInput, setAiInput] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Track what timezone the pattern entries are currently stored in
  // This is separate from the display timezone - patterns need to be converted before display
  const patternTimezoneRef = useRef(timezone);

  // Track if patterns have been initialized from server
  const patternsInitializedRef = useRef(false);

  // Date range for the grid
  const dateRange: DateRange = useMemo(
    () => ({
      startDate: event.startDate,
      endDate: event.endDate,
    }),
    [event.startDate, event.endDate]
  );

  // Convert rules to TimeSlots for VirtualizedAvailabilityGrid
  // Always compute from local state once initialized (for immediate feedback)
  const timeSlots = useMemo(() => {
    // Once initialized, always compute from local state (patterns + overrides)
    // This ensures UI reflects local edits immediately
    if (patternsInitializedRef.current) {
      // Use the timezone that patterns are stored in, not the display timezone
      // This ensures correct conversion even during timezone switch (before useEffect updates patterns)
      const sourceTimezone = patternTimezoneRef.current;
      // Convert local patterns to rules format for computation
      const localPatternRules = patternEntriesToRules(patternEntries, participantId, sourceTimezone);
      // Convert to AvailabilityRule format with placeholder IDs for computation
      const computeRules: AvailabilityRule[] = localPatternRules.map((r, i) => ({
        id: `local-${i}`,
        participantId: r.participantId,
        ruleType: r.ruleType,
        dayOfWeek: r.dayOfWeek,
        specificDate: r.specificDate,
        startTime: r.startTime,
        endTime: r.endTime,
        originalTimezone: r.originalTimezone,
        originalDayOfWeek: r.originalDayOfWeek,
        crossesMidnight: r.crossesMidnight, // CRITICAL: Pass through for full-day patterns
        reason: null,
        source: r.source || "manual",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      // Add local override slots as rules too (use ref for current state)
      // The ref is always kept current by both grid saves and AI adds
      const overrideRules: AvailabilityRule[] = localOverrideSlotsRef.current.map((slot, i) => ({
        id: `local-override-${i}`,
        participantId,
        ruleType: "available_override" as const,
        dayOfWeek: null,
        specificDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        originalTimezone: timezone,
        originalDayOfWeek: null,
        reason: null,
        source: "manual" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      const allLocalRules = [...computeRules, ...overrideRules];
      return rulesToTimeSlots(allLocalRules, dateRange);
    }
    // Initial load before initialization - use server rules directly
    return rulesToTimeSlots(effectiveRules, dateRange);
  }, [effectiveRules, dateRange, patternEntries, localOverrideSlots, participantId, timezone]);

  // Keep refs in sync with state
  useEffect(() => {
    patternEntriesRef.current = patternEntries;
  }, [patternEntries]);

  useEffect(() => {
    localOverrideSlotsRef.current = localOverrideSlots;
  }, [localOverrideSlots]);

  // Convert pattern entries when timezone changes
  useEffect(() => {
    const oldTimezone = patternTimezoneRef.current;
    const timezoneChanged = oldTimezone !== timezone;

    if (timezoneChanged && patternsInitializedRef.current && patternEntries.length > 0) {
      // Convert existing patterns from old timezone to new timezone
      const convertedPatterns = patternEntries.map((entry) => {
        const converted = convertPatternBetweenTimezones(
          entry.days,
          entry.startTime,
          entry.endTime,
          oldTimezone,
          timezone
        );
        return {
          ...entry,
          days: converted.days,
          startTime: converted.startTime,
          endTime: converted.endTime,
        };
      });
      setPatternEntries(convertedPatterns);
      patternEntriesRef.current = convertedPatterns;
      // Update the ref AFTER setting patterns - they're now in the new timezone
      patternTimezoneRef.current = timezone;
    } else if (timezoneChanged && patternsInitializedRef.current) {
      // No patterns to convert, just update the ref
      patternTimezoneRef.current = timezone;
    }
  }, [timezone, patternEntries]);

  // Initialize pattern entries from server rules on first load
  useEffect(() => {
    // Skip if already initialized or user is editing
    if (patternsInitializedRef.current || isUserEditingRef.current) {
      return;
    }

    // Don't initialize until data is loaded (prevents initializing with empty data)
    if (isLoading) {
      return;
    }

    const extracted = extractPatternEntries(effectiveRules, timezone);
    setPatternEntries(extracted);
    patternEntriesRef.current = extracted;

    // Also extract override slots (specific date rules) for local tracking
    const overrideRules = effectiveRules.filter(
      r => r.ruleType === "available_override" || r.ruleType === "blocked_override"
    );
    const overrideSlots: TimeSlot[] = overrideRules
      .filter(r => r.specificDate && r.ruleType === "available_override")
      .map(r => ({
        date: r.specificDate!,
        startTime: r.startTime,
        endTime: r.endTime,
      }));
    setLocalOverrideSlots(overrideSlots);
    localOverrideSlotsRef.current = overrideSlots;
    setHasGridSlots(overrideSlots.length > 0);

    patternsInitializedRef.current = true;
    patternTimezoneRef.current = timezone;
  }, [effectiveRules, timezone, isLoading]);

  // Handle grid save - optimistic, skip refetch to avoid flashing
  // Uses ref to update override slots without triggering timeSlots recalc (grid already has correct state)
  const handleGridSave = useCallback(
    async (slots: TimeSlot[]) => {
      // Store in ref only - don't trigger state update since grid manages its own display state
      // This prevents unnecessary timeSlots recalculation during drag operations
      localOverrideSlotsRef.current = slots;
      // Update lightweight flag for UI visibility (e.g., Clear All button)
      setHasGridSlots(slots.length > 0);

      // Keep existing pattern rules - use patternTimezoneRef to ensure consistency
      // (patterns are stored in the timezone referenced by patternTimezoneRef)
      const patternRules = patternEntriesToRules(patternEntriesRef.current, participantId, patternTimezoneRef.current);

      // Slots from grid are already in UTC - pass alreadyUTC=true to avoid double-conversion
      const overrideRules = timeSlotsToRules(slots, participantId, timezone, true);

      // Combine all rules
      const allRules = [...patternRules, ...overrideRules];

      try {
        // Pass skipRefetch=true to avoid re-rendering the grid
        const success = await replaceRules(allRules, true);
        if (success) {
          onSaveComplete?.();
          // Update save timestamp for CTA
          setSavedAt(new Date());
        }
      } catch {
        // Silently handle errors - user can retry
      }
    },
    [participantId, timezone, replaceRules, onSaveComplete]
  );

  // Debounced save for pattern changes - must be defined before handlers that use it
  const patternSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mark that user is editing (prevents useEffect from overwriting state)
  const markUserEditing = useCallback(() => {
    isUserEditingRef.current = true;
    // Clear any existing timeout
    if (userEditTimeoutRef.current) {
      clearTimeout(userEditTimeoutRef.current);
    }
    // Keep editing flag for 3 seconds after last edit (covers debounce + network)
    userEditTimeoutRef.current = setTimeout(() => {
      isUserEditingRef.current = false;
    }, 3000);
  }, []);

  // Show save CTA ref (to call from savePatterns)
  const showSaveCtaRef = useRef<() => void>(() => {});

  const savePatterns = useCallback(async () => {
    try {
      // Use refs to get latest state (avoids stale closure issues)
      const currentPatterns = patternEntriesRef.current;
      const currentOverrideSlots = localOverrideSlotsRef.current;

      // Convert pattern entries to rules (will convert to UTC)
      // Use patternTimezoneRef to ensure we convert from the correct source timezone
      const patternRules = patternEntriesToRules(currentPatterns, participantId, patternTimezoneRef.current);

      // Override slots from grid are already in UTC - pass alreadyUTC=true
      const overrideRules = timeSlotsToRules(currentOverrideSlots, participantId, timezone, true);

      // Skip refetch to avoid overwriting local state
      const success = await replaceRules([...patternRules, ...overrideRules], true);
      if (success) {
        onSaveComplete?.();
        showSaveCtaRef.current(); // Trigger CTA
      }
    } catch {
      // Silently handle errors - user can retry
    }
  }, [participantId, timezone, replaceRules, onSaveComplete]);

  const debouncedSavePatterns = useCallback(() => {
    if (patternSaveTimeoutRef.current) {
      clearTimeout(patternSaveTimeoutRef.current);
    }
    patternSaveTimeoutRef.current = setTimeout(() => {
      savePatterns();
    }, 500);
  }, [savePatterns]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (patternSaveTimeoutRef.current) {
        clearTimeout(patternSaveTimeoutRef.current);
      }
      if (userEditTimeoutRef.current) {
        clearTimeout(userEditTimeoutRef.current);
      }
    };
  }, []);

  // Update save timestamp (CTA is persistent once shown)
  const triggerSaveCta = useCallback(() => {
    setSavedAt(new Date());
  }, []);

  // Keep ref updated
  showSaveCtaRef.current = triggerSaveCta;

  // Handle copy link for GM
  const handleCopyLink = useCallback(() => {
    if (event.slug) {
      const url = `${window.location.origin}/${event.slug}`;
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [event.slug]);

  // Pattern editor handlers - all call markUserEditing to prevent useEffect overwrite
  const addPatternEntry = useCallback((days: number[], isAvailable: boolean = true) => {
    markUserEditing();
    const newEntry: PatternEntry = {
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      days,
      startTime: "17:00",
      endTime: "21:00",
      isAvailable,
    };
    setPatternEntries((prev) => {
      const updated = [...prev, newEntry];
      patternEntriesRef.current = updated;
      return updated;
    });
    debouncedSavePatterns();
    setShowAddMenu(false);
  }, [markUserEditing, debouncedSavePatterns]);

  const removePatternEntry = useCallback((id: string) => {
    markUserEditing();
    setPatternEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      patternEntriesRef.current = updated;
      return updated;
    });
    debouncedSavePatterns();
  }, [markUserEditing, debouncedSavePatterns]);

  const togglePatternDay = useCallback((entryId: string, dayValue: number) => {
    markUserEditing();
    setPatternEntries((prev) => {
      const updated = prev.map((e) => {
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
      });
      patternEntriesRef.current = updated;
      return updated;
    });
    debouncedSavePatterns();
  }, [markUserEditing, debouncedSavePatterns]);

  const updatePatternEntry = useCallback(
    (id: string, field: "startTime" | "endTime", value: string) => {
      markUserEditing();
      setPatternEntries((prev) => {
        const updated = prev.map((e) => (e.id === id ? { ...e, [field]: value } : e));
        patternEntriesRef.current = updated;
        return updated;
      });
      debouncedSavePatterns();
    },
    [markUserEditing, debouncedSavePatterns]
  );

  const togglePatternAvailability = useCallback((id: string) => {
    markUserEditing();
    setPatternEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, isAvailable: !e.isAvailable } : e));
      patternEntriesRef.current = updated;
      return updated;
    });
    debouncedSavePatterns();
  }, [markUserEditing, debouncedSavePatterns]);

  // Force re-extraction of patterns from server rules (used after AI adds rules)
  const forceReExtract = useCallback(() => {
    // Clear user editing flag so useEffect doesn't skip extraction
    isUserEditingRef.current = false;
    if (userEditTimeoutRef.current) {
      clearTimeout(userEditTimeoutRef.current);
      userEditTimeoutRef.current = null;
    }
    // Force re-initialization
    patternsInitializedRef.current = false;
  }, []);

  // Clear all availability
  const handleClearAll = useCallback(async () => {
    markUserEditing();
    // Clear local state
    setPatternEntries([]);
    patternEntriesRef.current = [];
    setLocalOverrideSlots([]);
    localOverrideSlotsRef.current = [];
    setHasGridSlots(false);
    // Save empty rules to server
    await replaceRules([], true);
    onSaveComplete?.();
  }, [markUserEditing, replaceRules, onSaveComplete]);

  // Handle AI input - add rules without page refresh
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
          timezone, // Pass the currently selected timezone to the AI
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
        // Extract patterns from AI rules and merge with existing patterns
        const aiPatternRules = result.rules.filter(
          (r: { ruleType: string }) => r.ruleType === "available_pattern" || r.ruleType === "blocked_pattern"
        );
        const aiOverrideRules = result.rules.filter(
          (r: { ruleType: string }) => r.ruleType === "available_override"
        );

        // Convert AI pattern rules to pattern entries and add to local state
        // IMPORTANT: AI rules are returned in UTC, must convert to user's timezone for display
        if (aiPatternRules.length > 0) {
          markUserEditing();
          // Group AI patterns by time range and type (after converting from UTC)
          const newPatterns: PatternEntry[] = [];
          const groups = new Map<string, PatternEntry>();

          for (const rule of aiPatternRules) {
            // Convert from UTC to user's display timezone
            // Pass crossesMidnight for full-day patterns (e.g., 08:00-08:00 with crossesMidnight=true)
            const converted = convertPatternFromUTC(
              rule.dayOfWeek,
              rule.startTime,
              rule.endTime,
              timezone,
              rule.crossesMidnight
            );

            const isAvailable = rule.ruleType === "available_pattern";
            const key = `${converted.startTime}-${converted.endTime}-${isAvailable}`;
            const existing = groups.get(key);
            if (existing) {
              if (!existing.days.includes(converted.dayOfWeek)) {
                existing.days.push(converted.dayOfWeek);
                existing.days.sort((a: number, b: number) => a - b);
              }
            } else {
              groups.set(key, {
                id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                days: [converted.dayOfWeek],
                startTime: converted.startTime,
                endTime: converted.endTime,
                isAvailable,
              });
            }
          }

          newPatterns.push(...groups.values());

          setPatternEntries((prev) => {
            const updated = [...prev, ...newPatterns];
            patternEntriesRef.current = updated;
            return updated;
          });
        }

        // Add override slots to local state
        if (aiOverrideRules.length > 0) {
          const newOverrides: TimeSlot[] = aiOverrideRules.map((r: { specificDate: string; startTime: string; endTime: string }) => ({
            date: r.specificDate,
            startTime: r.startTime,
            endTime: r.endTime,
          }));
          setLocalOverrideSlots((prev) => {
            const updated = [...prev, ...newOverrides];
            localOverrideSlotsRef.current = updated;
            return updated;
          });
          setHasGridSlots(true);
        }

        // Save all rules (existing patterns + new AI rules) without refetch
        const currentPatterns = patternEntriesRef.current;
        const currentOverrides = localOverrideSlotsRef.current;
        // Use patternTimezoneRef to ensure correct source timezone for pattern conversion
        const patternRules = patternEntriesToRules(currentPatterns, participantId, patternTimezoneRef.current);
        // Override slots are in UTC (both from grid and AI) - pass alreadyUTC=true
        const overrideRules = timeSlotsToRules(currentOverrides, participantId, timezone, true);
        await replaceRules([...patternRules, ...overrideRules], true);

        setAiInput("");
        onSaveComplete?.();
      }
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Failed to parse availability"
      );
    } finally {
      setIsParsingAI(false);
    }
  }, [aiInput, timezone, participantId, markUserEditing, replaceRules, onSaveComplete]);

  return (
    <div className="space-y-4">
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

      {/* Main Content */}
      {!isLoading && (
        <div className="space-y-4">
          {/* Full-width Calendar Grid */}
          <VirtualizedAvailabilityGrid
            startDate={new Date(event.startDate)}
            endDate={new Date(event.endDate)}
            earliestTime="00:00"
            latestTime="24:00"
            mode="edit"
            availability={timeSlots}
            onSave={handleGridSave}
            autoSave={true}
            timezone={timezone}
            gmAvailability={!isGm ? gmAvailability : []}
          />

          {/* Schedule Entries - Green/Red callout style */}
          {patternEntries.length > 0 && (
            <div className="space-y-2 max-w-2xl">
              {patternEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    entry.isAvailable
                      ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30"
                      : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                  }`}
                >
                  <button
                    onClick={() => togglePatternAvailability(entry.id)}
                    className={`flex-shrink-0 w-20 text-center rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                          className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? entry.isAvailable
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                              : "bg-white/50 text-gray-400 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700"
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
                    <span className="text-gray-400">–</span>
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
                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Schedule Button and Clear All */}
          <div className="flex items-center justify-between gap-4 max-w-2xl">
            <div className="relative flex-1">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="group flex w-full items-center justify-center gap-2.5 px-6 py-2.5 text-sm font-medium rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                Add Schedule
              </button>

              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                  <div className="fixed sm:absolute inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full z-20 sm:mt-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl sm:shadow-xl overflow-hidden sm:min-w-[360px] max-h-[70vh] overflow-y-auto">
                    {/* Available section */}
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20 border-b border-zinc-100 dark:border-zinc-800 sticky top-0">
                      Available
                    </div>
                    <div className="p-2">
                      {/* Presets */}
                      {DAY_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => addPatternEntry(preset.days, true)}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition-colors"
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-xs text-zinc-400">{preset.days.length} days</span>
                        </button>
                      ))}
                      {/* Individual days */}
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map((day) => (
                            <button
                              key={day.value}
                              onClick={() => addPatternEntry([day.value], true)}
                              className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400 rounded-lg transition-colors"
                            >
                              {day.short}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Blocked section */}
                    <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 border-y border-zinc-100 dark:border-zinc-800 sticky top-0">
                      Blocked
                    </div>
                    <div className="p-2">
                      {/* Presets */}
                      {DAY_PRESETS.map((preset) => (
                        <button
                          key={`blocked-${preset.value}`}
                          onClick={() => addPatternEntry(preset.days, false)}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-xs text-zinc-400">{preset.days.length} days</span>
                        </button>
                      ))}
                      {/* Individual days */}
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map((day) => (
                            <button
                              key={`blocked-${day.value}`}
                              onClick={() => addPatternEntry([day.value], false)}
                              className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                            >
                              {day.short}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Close button for mobile */}
                    <div className="sm:hidden p-3 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        onClick={() => setShowAddMenu(false)}
                        className="w-full py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Clear All - always visible, right-aligned */}
            <button
              onClick={handleClearAll}
              className="shrink-0 text-xs text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>

          {/* AI Assistant - Modern card with gradient accent */}
          <div className="mt-8 relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-900 dark:to-zinc-900/50">
            {/* Subtle gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

            <div className="p-5">
              {/* Header row - icon aligned with title */}
              <div className="flex items-center gap-3 mb-4">
                {/* AI Icon */}
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/20">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Schedule Assistant</h3>
                  <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Beta</span>
                </div>
              </div>

              {/* Content area */}
              <div className="space-y-3">
                <textarea
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Try: &quot;Available weekday evenings 6-10pm except Mondays&quot; or &quot;Free all day Saturday and Sunday&quot;"
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 resize-none transition-all"
                      rows={2}
                      disabled={isParsingAI}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAIParse();
                        }
                      }}
                    />

                    {/* Submit button below textarea */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleAIParse}
                        disabled={isParsingAI || !aiInput.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all disabled:hover:from-violet-600 disabled:hover:to-purple-600"
                      >
                        {isParsingAI ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add to Schedule
                          </>
                        )}
                      </button>
                </div>
              </div>

              {aiError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {aiError}
                </p>
              )}

              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Describe your availability in plain English. Press Enter to submit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Glass CTAs - persistent once saved */}
      {savedAt && event.slug && (
        isGm ? (
          <GmCompleteCta
            campaignSlug={event.slug}
            onCopyLink={handleCopyLink}
            linkCopied={linkCopied}
            savedAt={savedAt}
          />
        ) : (
          <PlayerCompleteCta
            campaignSlug={event.slug}
            participantId={participantId}
            hasCharacter={hasCharacter}
            savedAt={savedAt}
          />
        )
      )}
    </div>
  );
}
