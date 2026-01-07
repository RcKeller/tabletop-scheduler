"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startOfWeek, parseISO, format } from "date-fns";
import Link from "next/link";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import { JoinEventForm } from "@/components/participant/JoinEventForm";
import { CombinedHeatmap } from "@/components/heatmap/CombinedHeatmap";
import { WeekNavigator } from "@/components/navigation/WeekNavigator";
import { PlayerDetailModal } from "@/components/participant/PlayerDetailModal";
import { CampaignHeader } from "@/components/campaign/CampaignHeader";
import type { TimeSlot, MeetingType, CampaignType } from "@/lib/types";

interface GameSystem {
  id: string;
  name: string;
  imageBase64: string | null;
}

interface Participant {
  id: string;
  displayName: string;
  isGm: boolean;
  characterName: string | null;
  characterClass: string | null;
  characterSheetUrl: string | null;
  characterTokenBase64: string | null;
  notes: string | null;
}

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
  campaignType: CampaignType;
  meetingType: MeetingType | null;
  meetingLocation: string | null;
  meetingRoom: string | null;
  campaignImageBase64: string | null;
  customPreSessionInstructions: string | null;
  gameSystem: GameSystem | null;
  participants: Participant[];
}

interface ParticipantWithAvailability {
  id: string;
  name: string;
  availability: TimeSlot[];
}

interface CampaignPageProps {
  event: EventProps;
}

export function CampaignPage({ event }: CampaignPageProps) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(event.timezone);
  const [participantsWithAvailability, setParticipantsWithAvailability] = useState<ParticipantWithAvailability[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(event.participants);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const eventStartDate = useMemo(() => {
    return event.startDate ? parseISO(event.startDate) : new Date();
  }, [event.startDate]);

  const eventEndDate = useMemo(() => {
    return event.endDate ? parseISO(event.endDate) : eventStartDate;
  }, [event.endDate, eventStartDate]);

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(eventStartDate, { weekStartsOn: 0 })
  );

  // Check for stored participant ID
  useEffect(() => {
    const storedId = localStorage.getItem(`participant_${event.id}`);
    if (storedId) {
      const found = participants.find((p) => p.id === storedId);
      if (found) {
        setCurrentParticipant(found);
      }
    }
  }, [event.id, participants]);

  // Handle opening player profile modal
  const handleOpenProfile = useCallback((participant: Participant) => {
    setSelectedParticipant(participant);
    setIsProfileModalOpen(true);
  }, []);

  // Handle adding a new player (by anyone)
  const handleAddPlayer = useCallback(async () => {
    if (!newPlayerName.trim()) return;

    setIsAddingPlayer(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newPlayerName.trim() }),
      });

      if (res.ok) {
        const newParticipant = await res.json();
        setParticipants((prev) => [...prev, {
          ...newParticipant,
          characterName: null,
          characterClass: null,
          characterSheetUrl: null,
          characterTokenBase64: null,
          notes: null,
        }]);
        setNewPlayerName("");
        setShowAddPlayer(false);
      }
    } catch (error) {
      console.error("Failed to add player:", error);
    } finally {
      setIsAddingPlayer(false);
    }
  }, [newPlayerName, event.slug]);

  // Navigate to character edit page for current user
  const handleCreateCharacter = useCallback(() => {
    if (currentParticipant) {
      const playerSlug = encodeURIComponent(
        currentParticipant.displayName.toLowerCase().replace(/\s+/g, "-")
      );
      router.push(`/${event.slug}/${playerSlug}/character`);
    }
  }, [currentParticipant, event.slug, router]);

  // Load heatmap data
  useEffect(() => {
    async function loadHeatmapData() {
      try {
        const weekStartParam = currentWeekStart.toISOString();
        const res = await fetch(
          `/api/events/${event.slug}/heatmap?weekStart=${weekStartParam}`
        );
        if (res.ok) {
          const data = await res.json();
          setParticipantsWithAvailability(data.participants);
        }
      } catch (error) {
        console.error("Failed to load heatmap data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadHeatmapData();
  }, [event.slug, currentWeekStart]);

  const handleJoined = (participant: { id: string; displayName: string; isGm: boolean }) => {
    localStorage.setItem(`participant_${event.id}`, participant.id);
    // Navigate to player availability page
    const playerSlug = encodeURIComponent(participant.displayName.toLowerCase().replace(/\s+/g, "-"));
    router.push(`/${event.slug}/${playerSlug}`);
  };

  const handleEditAvailability = () => {
    if (currentParticipant) {
      const playerSlug = encodeURIComponent(currentParticipant.displayName.toLowerCase().replace(/\s+/g, "-"));
      router.push(`/${event.slug}/${playerSlug}`);
    }
  };

  const getMeetingInfo = () => {
    if (!event.meetingType) return null;
    const typeLabels: Record<string, string> = {
      DISCORD: "Discord",
      ZOOM: "Zoom",
      GOOGLE_MEET: "Google Meet",
      ROLL20: "Roll20",
      FOUNDRY_VTT: "Foundry VTT",
      IN_PERSON: "In Person",
      OTHER: "Other",
    };
    return {
      type: typeLabels[event.meetingType] || event.meetingType,
      location: event.meetingLocation,
      room: event.meetingRoom,
    };
  };

  const meetingInfo = getMeetingInfo();
  const hasGm = participants.some(p => p.isGm);

  // Check if current participant needs to complete profile
  const showProfileCallout = currentParticipant &&
    !currentParticipant.isGm &&
    event.customPreSessionInstructions &&
    (!currentParticipant.characterName && !currentParticipant.notes);

  const formatDateRange = () => {
    if (!event.startDate || !event.endDate) return null;
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section with Campaign Image */}
      <CampaignHeader
        title={event.title}
        campaignImageBase64={event.campaignImageBase64}
        gameSystem={event.gameSystem}
      />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-3">
        {/* First Section: Two columns */}
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Left Column: Campaign info + Session Details */}
          <div className="space-y-3 lg:col-span-2">
            {/* Description */}
            {event.description && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{event.description}</p>
              </div>
            )}

            {/* Player Prep / Pre-session Instructions */}
            {event.customPreSessionInstructions && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Before You Play
                </h2>
                <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                  {event.customPreSessionInstructions}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Registration, Party, Share Link */}
          <div className="space-y-3">
            {/* Join / Edit Availability Card */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              {currentParticipant ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {currentParticipant.displayName}
                      </p>
                      <p className="text-xs text-zinc-500">You're in this {event.campaignType === "ONESHOT" ? "game" : "campaign"}</p>
                    </div>
                  </div>

                  {/* Profile callout for players */}
                  {showProfileCallout && (
                    <button
                        onClick={handleCreateCharacter}
                        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Create your Character
                      </button>
                  )}

                  <button
                    onClick={handleEditAvailability}
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Edit Your Availability
                  </button>
                </div>
              ) : (
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Join This {event.campaignType === "ONESHOT" ? "Game" : "Campaign"}
                  </h2>
                  <JoinEventForm
                    eventSlug={event.slug}
                    onJoined={handleJoined}
                    hasGm={hasGm}
                  />
                </div>
              )}
            </div>

            {/* Party Members */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Party ({participants.length})
                </h2>
                {currentParticipant && !showAddPlayer && (
                  <button
                    onClick={() => setShowAddPlayer(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    + Add Player
                  </button>
                )}
              </div>

              {/* Add Player Form */}
              {showAddPlayer && (
                <div className="mb-3 rounded-md bg-zinc-50 p-2 dark:bg-zinc-800">
                  <p className="mb-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Add a player to the campaign
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player name..."
                      className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddPlayer();
                        if (e.key === "Escape") {
                          setShowAddPlayer(false);
                          setNewPlayerName("");
                        }
                      }}
                    />
                    <button
                      onClick={handleAddPlayer}
                      disabled={isAddingPlayer || !newPlayerName.trim()}
                      className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isAddingPlayer ? "..." : "Add"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPlayer(false);
                        setNewPlayerName("");
                      }}
                      className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {participants.length === 0 ? (
                <p className="text-sm text-zinc-500">No players yet</p>
              ) : (
                <div className="space-y-2">
                  {participants.map((p) => {
                    const isCurrentUser = currentParticipant?.id === p.id;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleOpenProfile(p)}
                        className="w-full rounded-md bg-zinc-50 p-2 text-left transition-colors hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        <div className="flex items-center gap-2">
                          {/* Character token or avatar */}
                          {p.characterTokenBase64 ? (
                            <img
                              src={p.characterTokenBase64}
                              alt={p.characterName || p.displayName}
                              className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                              {p.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {p.displayName}
                              </span>
                              {p.isGm && (
                                <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                  GM
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="shrink-0 text-xs text-zinc-400">(you)</span>
                              )}
                            </div>
                            {/* Show character info if available */}
                            {p.characterName && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {p.characterName}
                                {p.characterClass && (
                                  <span className="text-zinc-400 dark:text-zinc-500"> · {p.characterClass}</span>
                                )}
                              </p>
                            )}
                          </div>
                          {/* Info indicator */}
                          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        {p.notes && (
                          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                            {p.notes}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Share Link */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Share Link
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? window.location.href : `/${event.slug}`}
                  className="flex-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Second Section: Full-width Group Availability */}
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Group Availability
              </h2>
              <WeekNavigator
                currentWeekStart={currentWeekStart}
                eventStartDate={eventStartDate}
                eventEndDate={eventEndDate}
                onWeekChange={setCurrentWeekStart}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <TimezoneSelector
                value={timezone}
                onChange={setTimezone}
              />
            </div>
          </div>
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-4">
                {/* Skeleton loader for heatmap */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "300px" }} />
                  </div>
                  <div className="w-64 shrink-0">
                    <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "200px" }} />
                  </div>
                </div>
                <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "80px" }} />
              </div>
            ) : participantsWithAvailability.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-center">
                <div>
                  <p className="text-sm text-zinc-500">No availability data yet</p>
                  <p className="mt-1 text-xs text-zinc-400">Join and add your availability to get started</p>
                </div>
              </div>
            ) : (
              <CombinedHeatmap
                participants={participantsWithAvailability}
                weekStart={currentWeekStart}
                earliestTime={event.earliestTime}
                latestTime={event.latestTime}
                sessionLengthMinutes={event.sessionLengthMinutes}
                timezone={timezone}
                eventTimezone={event.timezone}
                sessionDetails={{
                  campaignType: event.campaignType,
                  sessionLengthMinutes: event.sessionLengthMinutes,
                  meetingType: meetingInfo?.type,
                  meetingLocation: meetingInfo?.location,
                  dateRange: formatDateRange(),
                  timeWindow: `${formatTime(event.earliestTime)} - ${formatTime(event.latestTime)}`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-4 border-t border-zinc-200 py-2 text-center text-xs text-zinc-500 dark:border-zinc-800">
        When2Play
      </footer>

      {/* Player Detail Modal */}
      {selectedParticipant && (
        <PlayerDetailModal
          participant={selectedParticipant}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedParticipant(null);
          }}
          eventSlug={event.slug}
          isCurrentUser={currentParticipant?.id === selectedParticipant.id}
        />
      )}
    </div>
  );
}

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = parseInt(hourStr);
  if (hour === 0) return `12:${minute} AM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  return `${hour - 12}:${minute} PM`;
}
