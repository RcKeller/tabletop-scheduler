"use client";

import { useState, useCallback, useMemo } from "react";
import { UnifiedGrid } from "./UnifiedGrid";
import { useTimezoneWithFallback } from "./TimezoneContext";
import { useAvailabilityRules } from "@/lib/hooks/useAvailabilityRules";
import {
  slotsToRanges,
  prepareRuleForStorage,
  type AvailabilityRule,
  type CreateAvailabilityRuleInput,
  type DateRange,
  COMMON_TIMEZONES,
} from "@/lib/availability";
import { parseAvailabilityWithRules } from "@/lib/ai/availability-parser";

interface AvailabilityEditorProps {
  /** Participant ID */
  participantId: string;
  /** Event information */
  event: {
    title: string;
    timezone: string;
    startDate: string;
    endDate: string;
    earliestTime: string;
    latestTime: string;
  };
  /** Whether this is the GM (affects copy/CTAs) */
  isGm?: boolean;
  /** Initial rules (optional, will fetch if not provided) */
  initialRules?: AvailabilityRule[];
  /** Callback when save is complete */
  onSaveComplete?: () => void;
}

export function AvailabilityEditor({
  participantId,
  event,
  isGm = false,
  initialRules,
  onSaveComplete,
}: AvailabilityEditorProps) {
  const { timezone, setTimezone, commonTimezones, getTimezoneLabel } =
    useTimezoneWithFallback();

  const {
    rules,
    isLoading,
    error,
    replaceRules,
    addRules,
    removeRules,
    setLocalRules,
  } = useAvailabilityRules({
    participantId,
    fetchOnMount: !initialRules,
  });

  // Use initial rules if provided
  const effectiveRules = initialRules || rules;

  // State for pending changes
  const [pendingAdds, setPendingAdds] = useState<
    { date: string; time: string }[]
  >([]);
  const [pendingRemoves, setPendingRemoves] = useState<
    { date: string; time: string }[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  // AI input state
  const [aiInput, setAiInput] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Date range for the grid
  const dateRange: DateRange = useMemo(
    () => ({
      startDate: event.startDate,
      endDate: event.endDate,
    }),
    [event.startDate, event.endDate]
  );

  // Handle selection complete from grid
  const handleSelectionComplete = useCallback(
    (cells: { date: string; time: string }[], mode: "add" | "remove") => {
      if (mode === "add") {
        setPendingAdds((prev) => [...prev, ...cells]);
      } else {
        setPendingRemoves((prev) => [...prev, ...cells]);
      }
    },
    []
  );

  // Convert pending changes to rules
  const convertPendingToRules = useCallback((): CreateAvailabilityRuleInput[] => {
    const newRules: CreateAvailabilityRuleInput[] = [];

    // Group pending adds by date and convert to ranges
    const addRangesByDate = slotsToRanges(pendingAdds);
    for (const [date, ranges] of addRangesByDate) {
      for (const range of ranges) {
        const startTime = `${Math.floor(range.startMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(range.startMinutes % 60)
          .toString()
          .padStart(2, "0")}`;
        const endTime = `${Math.floor(range.endMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(range.endMinutes % 60)
          .toString()
          .padStart(2, "0")}`;

        const prepared = prepareRuleForStorage(
          {
            ruleType: "available_override",
            specificDate: date,
            startTime,
            endTime,
          },
          timezone
        );

        newRules.push({
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

    // Group pending removes by date and convert to blocked_override rules
    const removeRangesByDate = slotsToRanges(pendingRemoves);
    for (const [date, ranges] of removeRangesByDate) {
      for (const range of ranges) {
        const startTime = `${Math.floor(range.startMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(range.startMinutes % 60)
          .toString()
          .padStart(2, "0")}`;
        const endTime = `${Math.floor(range.endMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(range.endMinutes % 60)
          .toString()
          .padStart(2, "0")}`;

        const prepared = prepareRuleForStorage(
          {
            ruleType: "blocked_override",
            specificDate: date,
            startTime,
            endTime,
          },
          timezone
        );

        newRules.push({
          participantId,
          ruleType: "blocked_override",
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

    return newRules;
  }, [pendingAdds, pendingRemoves, timezone, participantId]);

  // Save pending changes
  const handleSave = useCallback(async () => {
    if (pendingAdds.length === 0 && pendingRemoves.length === 0) return;

    setIsSaving(true);
    try {
      const newRules = convertPendingToRules();
      const success = await addRules(newRules);

      if (success) {
        setPendingAdds([]);
        setPendingRemoves([]);
        onSaveComplete?.();
      }
    } finally {
      setIsSaving(false);
    }
  }, [pendingAdds, pendingRemoves, convertPendingToRules, addRules, onSaveComplete]);

  // Clear pending changes
  const handleClear = useCallback(() => {
    setPendingAdds([]);
    setPendingRemoves([]);
  }, []);

  // Handle AI input
  const handleAIParse = useCallback(async () => {
    if (!aiInput.trim()) return;

    setIsParsingAI(true);
    setAiError(null);

    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await parseAvailabilityWithRules(
        aiInput,
        timezone,
        participantId,
        today
      );

      if (result.rules.length > 0) {
        const success = await addRules(result.rules);
        if (success) {
          setAiInput("");
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

  // Has pending changes
  const hasPendingChanges = pendingAdds.length > 0 || pendingRemoves.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {isGm ? "GM Availability" : "Your Availability"}
          </h2>
          <p className="text-sm text-gray-600">
            {isGm
              ? "Set your recurring availability for this campaign"
              : "Let the GM know when you can play"}
          </p>
        </div>

        {/* Timezone selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Timezone:</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            {commonTimezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Input */}
      <div className="bg-gray-50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Describe your availability
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="e.g., free weekday evenings 6-10pm, busy on Mondays"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
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
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500">
          Loading availability...
        </div>
      )}

      {/* Grid */}
      {!isLoading && (
        <UnifiedGrid
          rules={effectiveRules}
          dateRange={dateRange}
          earliestTime={event.earliestTime}
          latestTime={event.latestTime}
          displayTimezone={timezone}
          editable={true}
          onSelectionComplete={handleSelectionComplete}
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="text-sm text-gray-600">
          {hasPendingChanges && (
            <span>
              {pendingAdds.length > 0 && `+${pendingAdds.length} slots `}
              {pendingRemoves.length > 0 && `-${pendingRemoves.length} slots`}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {hasPendingChanges && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Clear Changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasPendingChanges || isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
