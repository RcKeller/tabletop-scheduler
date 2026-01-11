"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GameSystem, PrepUrl, MeetingType } from "@/lib/types";
import { GameSystemAutocomplete } from "@/components/campaign/GameSystemAutocomplete";
import { GameSystemModal } from "@/components/campaign/GameSystemModal";
import { SessionLengthSelector } from "@/components/campaign/SessionLengthSelector";
import { MeetingTypeSelector } from "@/components/campaign/MeetingTypeSelector";

interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  campaignType: string;
  sessionLengthMinutes: number;
  meetingType: MeetingType | null;
  meetingLocation: string | null;
  meetingRoom: string | null;
  customPreSessionInstructions: string | null;
  playerPrepUrls: PrepUrl[] | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  gameSystem: GameSystem | null;
}

interface CampaignSettingsPageProps {
  event: EventData;
}

export function CampaignSettingsPage({ event }: CampaignSettingsPageProps) {
  const router = useRouter();

  // Form state
  const [gameSystem, setGameSystem] = useState<GameSystem | null>(event.gameSystem);
  const [playerInstructions, setPlayerInstructions] = useState(
    event.customPreSessionInstructions || ""
  );
  const [playerPrepUrls, setPlayerPrepUrls] = useState<PrepUrl[]>(event.playerPrepUrls || []);
  const [minPlayers, setMinPlayers] = useState<string>(
    event.minPlayers?.toString() || "4"
  );
  const [maxPlayers, setMaxPlayers] = useState<string>(
    event.maxPlayers?.toString() || "6"
  );

  // Session settings (moved from schedule page)
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(event.sessionLengthMinutes);
  const [meetingType, setMeetingType] = useState<MeetingType | null>(event.meetingType);
  const [meetingLocation, setMeetingLocation] = useState(event.meetingLocation || "");
  const [meetingRoom, setMeetingRoom] = useState(event.meetingRoom || "");

  // Modal state
  const [isCreatingGameSystem, setIsCreatingGameSystem] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle game system change
  const handleGameSystemChange = useCallback(
    (system: GameSystem | null) => {
      setGameSystem(system);
      // Auto-fill instructions from game system if empty
      if (system?.defaultInstructions && !playerInstructions) {
        setPlayerInstructions(system.defaultInstructions);
      }
      if (system?.defaultUrls && playerPrepUrls.length === 0) {
        setPlayerPrepUrls(system.defaultUrls);
      }
    },
    [playerInstructions, playerPrepUrls.length]
  );

  // Handle game system created
  const handleGameSystemCreated = useCallback(
    (system: GameSystem) => {
      setIsCreatingGameSystem(false);
      handleGameSystemChange(system);
    },
    [handleGameSystemChange]
  );

  // URL handlers
  const handleAddUrl = useCallback(() => {
    setPlayerPrepUrls([...playerPrepUrls, { label: "", url: "" }]);
  }, [playerPrepUrls]);

  const handleRemoveUrl = useCallback(
    (index: number) => {
      setPlayerPrepUrls(playerPrepUrls.filter((_, i) => i !== index));
    },
    [playerPrepUrls]
  );

  const handleUpdateUrl = useCallback(
    (index: number, field: "label" | "url", value: string) => {
      const newUrls = [...playerPrepUrls];
      newUrls[index] = { ...newUrls[index], [field]: value };
      setPlayerPrepUrls(newUrls);
    },
    [playerPrepUrls]
  );

  // Save and continue
  const handleContinue = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        gameSystemId: gameSystem?.id || null,
        customPreSessionInstructions: playerInstructions || null,
        playerPrepUrls: playerPrepUrls.filter((u) => u.label && u.url),
        minPlayers: minPlayers ? parseInt(minPlayers) : 4,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : 6,
        // Session settings (moved from schedule page)
        sessionLengthMinutes,
        meetingType,
        meetingLocation: meetingLocation || null,
        meetingRoom: meetingRoom || null,
      };

      const res = await fetch(`/api/events/${event.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      // Continue to GM availability page (step 3)
      router.push(`/${event.slug}/gm-availability`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-xl px-4 py-6">
          {/* Step indicator - 3 steps */}
          <nav className="mb-4 flex items-center justify-center gap-1.5">
            <Link
              href="/"
              className="flex items-center gap-1 transition-colors hover:opacity-80"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs font-medium text-white">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Create</span>
            </Link>
            <div className="h-px w-6 bg-blue-400 dark:bg-blue-600" />
            <div className="flex items-center gap-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                2
              </div>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Details</span>
            </div>
            <div className="h-px w-6 bg-zinc-300 dark:bg-zinc-700" />
            <Link
              href={`/${event.slug}/gm-availability`}
              className="flex items-center gap-1 transition-colors hover:opacity-80"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                3
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Availability</span>
            </Link>
          </nav>

          <h1 className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Game Details
          </h1>
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {event.title}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="space-y-6">
          {/* Game System */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <GameSystemAutocomplete
              value={gameSystem}
              onChange={handleGameSystemChange}
              onCreateNew={() => setIsCreatingGameSystem(true)}
            />
            {gameSystem && (
              <Link
                href={`/${event.slug}/system/${gameSystem.id}`}
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View system details
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            {/* Table Size */}
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Table Size
              </label>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                How many players can join your game?
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Min</label>
                  <input
                    type="number"
                    min="1"
                    max="98"
                    value={minPlayers}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMinPlayers(val);
                      // Ensure max is always >= min
                      if (parseInt(val) > parseInt(maxPlayers)) {
                        setMaxPlayers(val);
                      }
                    }}
                    className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-medium text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                </div>
                <span className="text-zinc-400">—</span>
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Max</label>
                  <input
                    type="number"
                    min="1"
                    max="98"
                    value={maxPlayers}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMaxPlayers(val);
                      // Ensure min is always <= max
                      if (parseInt(val) < parseInt(minPlayers)) {
                        setMinPlayers(val);
                      }
                    }}
                    className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-medium text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">players</span>
              </div>
            </div>
          </div>

          {/* Session Settings (moved from schedule page) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Session Details
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Configure how long sessions are and where you&apos;ll meet
            </p>

            <div className="mt-4">
              <SessionLengthSelector
                value={sessionLengthMinutes}
                onChange={setSessionLengthMinutes}
              />
            </div>

            <div className="my-4 border-t border-zinc-200 dark:border-zinc-700" />

            <MeetingTypeSelector
              meetingType={meetingType}
              meetingLocation={meetingLocation}
              meetingRoom={meetingRoom}
              onMeetingTypeChange={setMeetingType}
              onMeetingLocationChange={setMeetingLocation}
              onMeetingRoomChange={setMeetingRoom}
            />
          </div>

          {/* Player Instructions */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <label
              htmlFor="instructions"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Player Instructions
            </label>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              What should players know or prepare? Character creation rules, house rules, etc.
            </p>
            <textarea
              id="instructions"
              value={playerInstructions}
              onChange={(e) => setPlayerInstructions(e.target.value)}
              placeholder="e.g., We're using standard 5e rules with the following house rules..."
              rows={6}
              className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />

            {/* Helpful Links */}
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Helpful Links
              </label>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Character builders, rules references, session notes, etc.
              </p>
              <div className="mt-2 space-y-2">
                {playerPrepUrls.map((urlItem, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={urlItem.label}
                      onChange={(e) => handleUpdateUrl(index, "label", e.target.value)}
                      placeholder="Label"
                      className="w-1/3 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <input
                      type="url"
                      value={urlItem.url}
                      onChange={(e) => handleUpdateUrl(index, "url", e.target.value)}
                      placeholder="https://..."
                      className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(index)}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  + Add link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            href={`/${event.slug}/gm-availability`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            Skip this step
          </Link>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Continue"}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Game System Modal */}
      <GameSystemModal
        isOpen={isCreatingGameSystem}
        onClose={() => setIsCreatingGameSystem(false)}
        onCreated={handleGameSystemCreated}
      />
    </div>
  );
}
