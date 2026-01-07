"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GameSystem, MeetingType, PrepUrl } from "@/lib/types";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { GameSystemAutocomplete } from "@/components/campaign/GameSystemAutocomplete";
import { GameSystemModal } from "@/components/campaign/GameSystemModal";
import { SessionLengthSelector } from "@/components/campaign/SessionLengthSelector";
import { DateRangePicker } from "@/components/campaign/DateRangePicker";
import { TimeWindowSelector } from "@/components/campaign/TimeWindowSelector";
import { MeetingTypeSelector } from "@/components/campaign/MeetingTypeSelector";
import { PreSessionInstructions } from "@/components/campaign/PreSessionInstructions";

interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  campaignType: string;
  startDate: string | null;
  endDate: string | null;
  earliestTime: string;
  latestTime: string;
  sessionLengthMinutes: number;
  meetingType: MeetingType | null;
  meetingLocation: string | null;
  meetingRoom: string | null;
  campaignImageBase64: string | null;
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
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(event.sessionLengthMinutes);
  const [startDate, setStartDate] = useState<string | null>(event.startDate);
  const [endDate, setEndDate] = useState<string | null>(event.endDate);
  const [earliestTime, setEarliestTime] = useState(event.earliestTime);
  const [latestTime, setLatestTime] = useState(event.latestTime);
  const [meetingType, setMeetingType] = useState<MeetingType | null>(event.meetingType);
  const [meetingLocation, setMeetingLocation] = useState(event.meetingLocation || "");
  const [meetingRoom, setMeetingRoom] = useState(event.meetingRoom || "");
  const [preSessionInstructions, setPreSessionInstructions] = useState(
    event.customPreSessionInstructions || ""
  );
  const [playerPrepUrls, setPlayerPrepUrls] = useState<PrepUrl[]>(event.playerPrepUrls || []);
  const [minPlayers, setMinPlayers] = useState<string>(event.minPlayers?.toString() || "");
  const [maxPlayers, setMaxPlayers] = useState<string>(event.maxPlayers?.toString() || "");

  // Modal state
  const [isCreatingGameSystem, setIsCreatingGameSystem] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Mark as changed when any field updates
  const markChanged = useCallback(() => setHasChanges(true), []);

  // Handle game system change
  const handleGameSystemChange = useCallback(
    (system: GameSystem | null) => {
      setGameSystem(system);
      markChanged();
      // Auto-fill instructions from game system if empty
      if (system?.defaultInstructions && !preSessionInstructions) {
        setPreSessionInstructions(system.defaultInstructions);
      }
      if (system?.defaultUrls && playerPrepUrls.length === 0) {
        setPlayerPrepUrls(system.defaultUrls);
      }
    },
    [preSessionInstructions, playerPrepUrls.length, markChanged]
  );

  // Handle game system created
  const handleGameSystemCreated = useCallback(
    (system: GameSystem) => {
      setIsCreatingGameSystem(false);
      handleGameSystemChange(system);
    },
    [handleGameSystemChange]
  );

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        gameSystemId: gameSystem?.id || null,
        sessionLengthMinutes,
        startDate,
        endDate,
        earliestTime,
        latestTime,
        meetingType,
        meetingLocation: meetingLocation || null,
        meetingRoom: meetingRoom || null,
        customPreSessionInstructions: preSessionInstructions || null,
        playerPrepUrls: playerPrepUrls.filter((u) => u.label && u.url),
        minPlayers: minPlayers ? parseInt(minPlayers) : null,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
      };

      const res = await fetch(`/api/events/${event.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setHasChanges(false);
      router.push(`/${event.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${event.slug}`}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Campaign Settings
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{event.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-4">
          {/* Game & Session */}
          <CollapsibleSection
            title="Game & Session"
            description="What game are you playing?"
            defaultOpen={true}
          >
            <div className="space-y-4">
              <GameSystemAutocomplete
                value={gameSystem}
                onChange={handleGameSystemChange}
                onCreateNew={() => setIsCreatingGameSystem(true)}
              />
              <SessionLengthSelector
                value={sessionLengthMinutes}
                onChange={(v) => {
                  setSessionLengthMinutes(v);
                  markChanged();
                }}
              />
            </div>
          </CollapsibleSection>

          {/* Scheduling Window */}
          <CollapsibleSection
            title="Scheduling Window"
            description="When can sessions happen?"
            defaultOpen={!event.startDate}
          >
            <div className="space-y-4">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={(v) => {
                  setStartDate(v);
                  markChanged();
                }}
                onEndDateChange={(v) => {
                  setEndDate(v);
                  markChanged();
                }}
              />
              <TimeWindowSelector
                earliestTime={earliestTime}
                latestTime={latestTime}
                onEarliestChange={(v) => {
                  setEarliestTime(v);
                  markChanged();
                }}
                onLatestChange={(v) => {
                  setLatestTime(v);
                  markChanged();
                }}
              />
            </div>
          </CollapsibleSection>

          {/* Meeting Details */}
          <CollapsibleSection
            title="Meeting Details"
            description="Where will you play?"
            badge={meetingType ? "Configured" : undefined}
          >
            <MeetingTypeSelector
              meetingType={meetingType}
              meetingLocation={meetingLocation}
              meetingRoom={meetingRoom}
              onMeetingTypeChange={(v) => {
                setMeetingType(v);
                markChanged();
              }}
              onMeetingLocationChange={(v) => {
                setMeetingLocation(v);
                markChanged();
              }}
              onMeetingRoomChange={(v) => {
                setMeetingRoom(v);
                markChanged();
              }}
            />
          </CollapsibleSection>

          {/* Player Setup */}
          <CollapsibleSection
            title="Player Setup"
            description="Instructions and resources for players"
            badge={preSessionInstructions ? "Has instructions" : undefined}
          >
            <div className="space-y-4">
              <PreSessionInstructions
                value={preSessionInstructions}
                defaultValue={gameSystem?.defaultInstructions || ""}
                onChange={(v) => {
                  setPreSessionInstructions(v);
                  markChanged();
                }}
                urls={playerPrepUrls}
                defaultUrls={gameSystem?.defaultUrls || []}
                onUrlsChange={(v) => {
                  setPlayerPrepUrls(v);
                  markChanged();
                }}
              />

              {/* Player limits */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Player Limits
                </label>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Optional minimum/maximum player counts
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="minPlayers"
                      className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      Minimum
                    </label>
                    <input
                      type="number"
                      id="minPlayers"
                      min="1"
                      max="20"
                      value={minPlayers}
                      onChange={(e) => {
                        setMinPlayers(e.target.value);
                        markChanged();
                      }}
                      placeholder="e.g., 3"
                      className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <span className="mt-5 text-zinc-400">to</span>
                  <div className="flex-1">
                    <label
                      htmlFor="maxPlayers"
                      className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      Maximum
                    </label>
                    <input
                      type="number"
                      id="maxPlayers"
                      min="1"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => {
                        setMaxPlayers(e.target.value);
                        markChanged();
                      }}
                      placeholder="e.g., 6"
                      className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>
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
            href={`/${event.slug}`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            Skip for now
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save & Continue"}
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
