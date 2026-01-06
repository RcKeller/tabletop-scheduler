"use client";

import { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { OverlapResult, OverlapSlot } from "@/lib/types";

interface OverlapPreviewProps {
  eventSlug: string;
  timezone: string;
  refreshKey: number;
}

interface ApiResponse {
  overlap: OverlapResult;
  participants: Array<{
    id: string;
    displayName: string;
    isGm: boolean;
    hasAvailability: boolean;
  }>;
  participantNames: Record<string, string>;
}

function formatTimeRange(
  startTime: string,
  endTime: string,
  date: string,
  timezone: string
): string {
  // Create date objects in UTC
  const startDate = parse(`${date} ${startTime}`, "yyyy-MM-dd HH:mm", new Date());
  const endDate = parse(`${date} ${endTime}`, "yyyy-MM-dd HH:mm", new Date());

  const startFormatted = formatInTimeZone(startDate, timezone, "h:mm a");
  const endFormatted = formatInTimeZone(endDate, timezone, "h:mm a");

  return `${startFormatted} - ${endFormatted}`;
}

function formatDate(dateStr: string, timezone: string): string {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return formatInTimeZone(date, timezone, "EEE, MMM d");
}

function SlotCard({
  slot,
  timezone,
  participantNames,
  isPerfect,
}: {
  slot: OverlapSlot;
  timezone: string;
  participantNames: Record<string, string>;
  isPerfect: boolean;
}) {
  const percentage = Math.round(
    (slot.availableCount / slot.totalParticipants) * 100
  );

  return (
    <div
      className={`rounded-md border p-3 ${
        isPerfect
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatDate(slot.date, timezone)}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {formatTimeRange(slot.startTime, slot.endTime, slot.date, timezone)}
          </div>
        </div>
        <div
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isPerfect
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
          }`}
        >
          {slot.availableCount}/{slot.totalParticipants}
        </div>
      </div>

      {/* Available participants */}
      <div className="mt-2 flex flex-wrap gap-1">
        {slot.availableParticipants.slice(0, 5).map((id) => (
          <span
            key={id}
            className="inline-block rounded bg-white px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          >
            {participantNames[id] || "Unknown"}
          </span>
        ))}
        {slot.availableParticipants.length > 5 && (
          <span className="inline-block rounded bg-white px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
            +{slot.availableParticipants.length - 5} more
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full ${
            isPerfect ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function OverlapPreview({
  eventSlug,
  timezone,
  refreshKey,
}: OverlapPreviewProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/events/${eventSlug}/availability`);
        if (!res.ok) {
          throw new Error("Failed to load");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [eventSlug, refreshKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { overlap, participants, participantNames } = data;

  // Check how many have set availability
  const withAvailability = participants.filter((p) => p.hasAvailability).length;

  if (participants.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No one has joined yet. Share the link to get started!
      </p>
    );
  }

  if (withAvailability === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Waiting for availability from:
        </p>
        <ul className="space-y-1">
          {participants.map((p) => (
            <li
              key={p.id}
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              {p.displayName}
              {p.isGm && (
                <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">
                  (GM)
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const hasPerfectSlots = overlap.perfectSlots.length > 0;
  const hasBestSlots = overlap.bestSlots.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        {withAvailability} of {participants.length} have set availability
      </div>

      {/* Perfect times */}
      {hasPerfectSlots && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Everyone Available ({overlap.perfectSlots.length})
          </h3>
          <div className="space-y-2">
            {overlap.perfectSlots.slice(0, 5).map((slot, i) => (
              <SlotCard
                key={i}
                slot={slot}
                timezone={timezone}
                participantNames={participantNames}
                isPerfect
              />
            ))}
          </div>
        </div>
      )}

      {/* Best times */}
      {hasBestSlots && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            Most Available ({overlap.bestSlots.length})
          </h3>
          <div className="space-y-2">
            {overlap.bestSlots.slice(0, 5).map((slot, i) => (
              <SlotCard
                key={i}
                slot={slot}
                timezone={timezone}
                participantNames={participantNames}
                isPerfect={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* No overlap */}
      {!hasPerfectSlots && !hasBestSlots && withAvailability > 0 && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          No overlapping availability found yet. More people need to add their
          schedules.
        </div>
      )}

      {/* Missing availability */}
      {participants.some((p) => !p.hasAvailability) && (
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Still Waiting On
          </h4>
          <ul className="mt-2 space-y-1">
            {participants
              .filter((p) => !p.hasAvailability)
              .map((p) => (
                <li
                  key={p.id}
                  className="text-sm text-zinc-600 dark:text-zinc-400"
                >
                  {p.displayName}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
