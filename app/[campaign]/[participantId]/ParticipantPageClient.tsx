"use client";

import { useState, useCallback } from "react";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";

interface EventData {
  id: string;
  slug: string;
  title: string;
  timezone: string;
  startDate: string;
  endDate: string;
  earliestTime: string;
  latestTime: string;
}

interface ParticipantData {
  id: string;
  displayName: string;
  isGm: boolean;
  timezone: string;
}

interface ParticipantPageClientProps {
  event: EventData;
  participant: ParticipantData;
  campaignSlug: string;
}

export function ParticipantPageClient({
  event,
  participant: initialParticipant,
  campaignSlug,
}: ParticipantPageClientProps) {
  const [participant, setParticipant] = useState(initialParticipant);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(participant.displayName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSaveName = useCallback(async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setNameError("Name cannot be empty");
      return;
    }
    if (trimmedName === participant.displayName) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    setNameError(null);

    try {
      const response = await fetch(`/api/participants/${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmedName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update name");
      }

      const updated = await response.json();
      setParticipant((prev) => ({ ...prev, displayName: updated.displayName }));
      setIsEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  }, [editName, participant.displayName, participant.id]);

  const handleCancelEdit = useCallback(() => {
    setEditName(participant.displayName);
    setIsEditingName(false);
    setNameError(null);
  }, [participant.displayName]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header with editable name */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {participant.isGm ? "GM Availability" : "Your Availability"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {participant.isGm
              ? "Set when you can run sessions"
              : "Let the GM know when you can play"}
          </p>
        </div>

        {/* Participant name with edit */}
        <div className="text-right">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            Editing as
          </div>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                autoFocus
                disabled={isSavingName}
              />
              <button
                onClick={handleSaveName}
                disabled={isSavingName}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingName ? "..." : "Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSavingName}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-1.5 text-right"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {participant.displayName}
              </span>
              {participant.isGm && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  GM
                </span>
              )}
              <svg
                className="h-3.5 w-3.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}
          {nameError && (
            <div className="mt-1 text-xs text-red-600">{nameError}</div>
          )}
        </div>
      </div>

      {/* Main availability editor */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <AvailabilityEditor
          participantId={participant.id}
          event={event}
          isGm={participant.isGm}
        />
      </div>

      {/* Tips section */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
        <h3 className="mb-2 font-medium text-blue-900 dark:text-blue-200">
          {participant.isGm ? "GM Tips" : "Player Tips"}
        </h3>
        <ul className="space-y-1.5 text-sm text-blue-800 dark:text-blue-300">
          {participant.isGm ? (
            <>
              <li>
                Set your recurring availability to define when you can run sessions
              </li>
              <li>
                Players will see your availability as the &quot;playable window&quot;
              </li>
              <li>
                Use the AI input to quickly add complex schedules (e.g., &quot;weekday evenings 6-10pm&quot;)
              </li>
            </>
          ) : (
            <>
              <li>Click and drag to select time slots when you&apos;re available</li>
              <li>
                The GM will see everyone&apos;s availability combined on a heatmap
              </li>
              <li>
                You can use natural language to describe your schedule (e.g., &quot;free weekends&quot;)
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
