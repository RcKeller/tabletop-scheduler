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
  gmAvailability?: { date: string; startTime: string; endTime: string }[];
}

export function ParticipantPageClient({
  event,
  participant: initialParticipant,
  campaignSlug,
  gmAvailability = [],
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <div className={`relative overflow-hidden ${participant.isGm ? "bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800" : "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800"}`}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Left: Title and description */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {participant.isGm ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    {participant.isGm ? "GM Availability" : "Set Your Availability"}
                  </h1>
                  <p className="text-white/80 text-sm sm:text-base">
                    {participant.isGm
                      ? "Define when you can run game sessions"
                      : "Let your GM know when you're free to play"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: User card with glass effect */}
            <div className="backdrop-blur-md bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-xs text-white/60 mb-1">Editing as</div>
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
                    className="w-36 rounded-lg border-0 bg-white/20 px-3 py-1.5 text-sm text-white placeholder-white/50 focus:ring-2 focus:ring-white/50"
                    autoFocus
                    disabled={isSavingName}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {isSavingName ? "..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSavingName}
                    className="text-white/60 hover:text-white text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="group flex items-center gap-2"
                >
                  <span className="font-semibold text-white">
                    {participant.displayName}
                  </span>
                  {participant.isGm && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                      GM
                    </span>
                  )}
                  <svg
                    className="h-3.5 w-3.5 text-white/50 opacity-0 transition-opacity group-hover:opacity-100"
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
                <div className="mt-1 text-xs text-red-300">{nameError}</div>
              )}
            </div>
          </div>

          {/* Tips as subtle cards in hero */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {participant.isGm ? (
              <>
                <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Recurring Patterns
                  </div>
                  <p className="text-white/60 text-xs">Set weekly availability that repeats automatically</p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Player Visibility
                  </div>
                  <p className="text-white/60 text-xs">Players see your availability as the playable window</p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Assistant
                  </div>
                  <p className="text-white/60 text-xs">Type &quot;weekday evenings 6-10pm&quot; to add quickly</p>
                </div>
              </>
            ) : (
              <>
                <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Click &amp; Drag
                  </div>
                  <p className="text-white/60 text-xs">Select time slots on the grid when you&apos;re available</p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Recurring Schedules
                  </div>
                  <p className="text-white/60 text-xs">Add weekly patterns that repeat automatically</p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Assistant
                  </div>
                  <p className="text-white/60 text-xs">Type &quot;free weekends&quot; to add availability quickly</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Full width grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
        <AvailabilityEditor
          participantId={participant.id}
          event={{ ...event, slug: event.slug }}
          isGm={participant.isGm}
          gmAvailability={gmAvailability}
        />
      </div>
    </div>
  );
}
