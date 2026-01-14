"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import { JoinEventForm } from "@/components/participant/JoinEventForm";
import { VirtualizedAvailabilityGrid } from "@/components/availability/VirtualizedAvailabilityGrid";
import { HoverDetailPanel } from "@/components/heatmap/HoverDetailPanel";
import { PlayerDetailModal } from "@/components/participant/PlayerDetailModal";
import { CampaignHeader } from "@/components/campaign/CampaignHeader";
import { Footer } from "@/components/layout/Footer";
import { EmptyPartyList } from "@/components/empty-states/EmptyPartyList";
import { EmptyHeatmap } from "@/components/empty-states/EmptyHeatmap";
import { FloatingGlassCta, JoinCta } from "@/components/ui/FloatingGlassCta";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useTimezone } from "@/components/layout/TimezoneProvider";
import type { MeetingType, CampaignType, Participant, ParticipantWithAvailability } from "@/lib/types";
import { convertDateTime } from "@/lib/utils/timezone";

// Tabs removed - all content now stacked vertically

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
  minPlayers: number | null;
  maxPlayers: number | null;
  gameSystem: { id: string; name: string; imageBase64: string | null } | null;
  participants: Participant[];
}

interface CampaignPageProps {
  event: EventProps;
}

export function CampaignPage({ event }: CampaignPageProps) {
  const router = useRouter();

  // Use shared timezone from context (managed by navbar)
  const { timezone } = useTimezone();

  const [participantsWithAvailability, setParticipantsWithAvailability] = useState<ParticipantWithAvailability[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Effective time bounds from heatmap API (calculated from GM availability)
  const [effectiveTimeBounds, setEffectiveTimeBounds] = useState<{
    earliestTime: string;
    latestTime: string;
    timezone: string;
  } | null>(null);
  // GM availability info for callout
  const [gmAvailability, setGmAvailability] = useState<{
    name: string;
    earliestTime: string | null;
    latestTime: string | null;
    timezone: string;
  } | null>(null);
  // Toggle to show full 24-hour view
  const [showFullDay, setShowFullDay] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(event.participants);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<{ id: string; name: string } | null>(null);

  const eventStartDate = useMemo(() => {
    return event.startDate ? parseISO(event.startDate) : new Date();
  }, [event.startDate]);

  const eventEndDate = useMemo(() => {
    return event.endDate ? parseISO(event.endDate) : eventStartDate;
  }, [event.endDate, eventStartDate]);

  // Hovered slot info for the hover panel
  const [hoveredSlotInfo, setHoveredSlotInfo] = useState<{
    date: string;
    time: string;
    available: { id: string; name: string }[];
    unavailable: { id: string; name: string }[];
  } | null>(null);

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

  // Handle removing a player - show confirmation modal
  const handleRemovePlayer = useCallback((participantId: string, displayName: string) => {
    setPlayerToRemove({ id: participantId, name: displayName });
  }, []);

  // Execute player removal after confirmation
  const executeRemovePlayer = useCallback(async () => {
    if (!playerToRemove) return;

    try {
      const res = await fetch(`/api/participants/${playerToRemove.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setParticipants((prev) => prev.filter(p => p.id !== playerToRemove.id));
        setParticipantsWithAvailability((prev) => prev.filter(p => p.id !== playerToRemove.id));
        // Close profile modal if the removed player was being viewed
        if (selectedParticipant?.id === playerToRemove.id) {
          setIsProfileModalOpen(false);
          setSelectedParticipant(null);
        }
        // Clear current participant if removed
        if (currentParticipant?.id === playerToRemove.id) {
          setCurrentParticipant(null);
          localStorage.removeItem(`participant_${event.id}`);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove player");
      }
    } catch (error) {
      console.error("Failed to remove player:", error);
      alert("Failed to remove player");
    } finally {
      setPlayerToRemove(null);
    }
  }, [playerToRemove, selectedParticipant, currentParticipant, event.id]);

  // Load heatmap data
  const loadHeatmapData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.slug}/heatmap`);
      if (res.ok) {
        const data = await res.json();
        setParticipantsWithAvailability(data.participants);
        // Use effective time bounds from heatmap API (calculated from GM availability)
        if (data.event) {
          setEffectiveTimeBounds({
            earliestTime: data.event.earliestTime,
            latestTime: data.event.latestTime,
            timezone: data.event.timezone,
          });
        }
        // Store GM availability info for callout
        if (data.gmAvailability) {
          setGmAvailability(data.gmAvailability);
        }
      }
    } catch (error) {
      console.error("Failed to load heatmap data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [event.slug]);

  // Initial load
  useEffect(() => {
    loadHeatmapData();
  }, [loadHeatmapData]);

  // Refetch when page becomes visible (handles navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadHeatmapData();
      }
    };

    // Also handle popstate for back/forward navigation
    const handlePopState = () => {
      loadHeatmapData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [loadHeatmapData]);

  const handleJoined = (participant: { id: string; displayName: string; isGm: boolean }) => {
    localStorage.setItem(`participant_${event.id}`, participant.id);
    // Use "gm" for GM participants, otherwise use participant ID
    const participantPath = participant.isGm ? "gm" : participant.id;
    router.push(`/${event.slug}/${participantPath}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
  const gmParticipant = participants.find(p => p.isGm);
  const hasGm = !!gmParticipant;
  const playerCount = participants.filter(p => !p.isGm).length;
  const isAtCapacity = event.maxPlayers !== null && playerCount >= event.maxPlayers;

  // Check if GM has set availability
  const gmHasAvailability = useMemo(() => {
    if (!gmParticipant) return false;
    const gmWithAvailability = participantsWithAvailability.find(p => p.id === gmParticipant.id);
    return gmWithAvailability && gmWithAvailability.availability.length > 0;
  }, [gmParticipant, participantsWithAvailability]);

  // Extract GM availability slots for visual indication on heatmap
  const gmAvailabilitySlots = useMemo(() => {
    if (!gmParticipant) return [];
    const gmWithAvailability = participantsWithAvailability.find(p => p.id === gmParticipant.id);
    return gmWithAvailability?.availability || [];
  }, [gmParticipant, participantsWithAvailability]);

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
        slug={event.slug}
        onShare={handleCopyLink}
        shareLabel={copiedLink ? "Copied!" : "Share"}
      />

      {/* Main Content - Centered single column, all sections stacked */}
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
        {/* Campaign Details Section */}
        <div className="space-y-4">
          {/* About / Before You Play - Combined */}
          {(event.description || event.customPreSessionInstructions) && (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                About this {event.campaignType === "ONESHOT" ? "Game" : "Campaign"}
              </h3>
              {event.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {event.description}
                </p>
              )}
              {event.customPreSessionInstructions && (
                <div className={event.description ? "mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700" : ""}>
                  <h4 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Before You Play
                  </h4>
                  <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {event.customPreSessionInstructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Session Details */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Session Details
            </h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {event.gameSystem && (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Game System</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{event.gameSystem.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Session Length</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {event.sessionLengthMinutes >= 60
                    ? `${Math.floor(event.sessionLengthMinutes / 60)}h ${event.sessionLengthMinutes % 60 > 0 ? `${event.sessionLengthMinutes % 60}m` : ""}`
                    : `${event.sessionLengthMinutes}m`}
                </dd>
              </div>
              {formatDateRange() && (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Date Range</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">{formatDateRange()}</dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Time Window</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatTime(effectiveTimeBounds?.earliestTime || event.earliestTime)} - {formatTime(effectiveTimeBounds?.latestTime || event.latestTime)}
                </dd>
              </div>
              {meetingInfo && (
                <>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">Platform</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-100">{meetingInfo.type}</dd>
                  </div>
                  {meetingInfo.location && (
                    <div>
                      <dt className="text-zinc-500 dark:text-zinc-400">Location</dt>
                      <dd className="font-medium text-zinc-900 dark:text-zinc-100">{meetingInfo.location}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Group Availability Section - responsive (hide sidebar on mobile) */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Group Availability
            </span>
          </div>
          <div className="p-3">
            {/* GM Availability Status Callout */}
            {hasGm && !isLoading && (
              <div className={`mb-3 rounded-lg border p-3 ${
                gmHasAvailability
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
              }`}>
                <div className="flex items-center gap-2">
                  <svg className={`h-4 w-4 shrink-0 ${gmHasAvailability ? "text-green-500 dark:text-green-400" : "text-amber-500 dark:text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {gmHasAvailability ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                  <span className={`text-sm ${gmHasAvailability ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}>
                    {gmHasAvailability
                      ? `${gmParticipant?.displayName} (GM) has set their availability`
                      : `${gmParticipant?.displayName} (GM) hasn't set their availability yet`
                    }
                  </span>
                </div>
              </div>
            )}

            {/* GM availability callout and view toggle */}
            {!isLoading && gmAvailability && gmAvailability.earliestTime && gmAvailability.latestTime && (() => {
              // Convert GM availability times from event timezone to user's timezone
              const refDate = format(eventStartDate, "yyyy-MM-dd");
              const localEarliest = gmAvailability.timezone !== timezone
                ? convertDateTime(gmAvailability.earliestTime, refDate, gmAvailability.timezone, timezone).time
                : gmAvailability.earliestTime;
              const localLatest = gmAvailability.timezone !== timezone
                ? convertDateTime(gmAvailability.latestTime, refDate, gmAvailability.timezone, timezone).time
                : gmAvailability.latestTime;

              return (
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">{gmAvailability.name}</span> (GM) is available from{" "}
                    <span className="font-medium">{formatTime(localEarliest)}</span> to{" "}
                    <span className="font-medium">{formatTime(localLatest)}</span>
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showFullDay}
                      onChange={(e) => setShowFullDay(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                    />
                    <span className="text-zinc-600 dark:text-zinc-400">Show full 24 hours</span>
                  </label>
                </div>
              );
            })()}

            {isLoading ? (
              <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "300px" }} />
            ) : participantsWithAvailability.length === 0 ? (
              <EmptyHeatmap hasPlayers={participants.length > 0} />
            ) : (
              <div className="flex gap-4">
                <div className="flex-1">
                  <VirtualizedAvailabilityGrid
                    key={`heatmap-${timezone}-${showFullDay}-${effectiveTimeBounds?.earliestTime}-${effectiveTimeBounds?.latestTime}`}
                    startDate={eventStartDate}
                    endDate={eventEndDate}
                    earliestTime={showFullDay ? "00:00" : (effectiveTimeBounds?.earliestTime || event.earliestTime)}
                    latestTime={showFullDay ? "23:30" : (effectiveTimeBounds?.latestTime || event.latestTime)}
                    timeWindowTimezone={effectiveTimeBounds?.timezone || event.timezone}
                    mode="heatmap"
                    participants={participantsWithAvailability.map(p => ({
                      id: p.id,
                      name: p.name,
                      availability: p.availability,
                    }))}
                    gmAvailability={gmAvailabilitySlots}
                    onHoverSlot={(date, time, available, unavailable) => {
                      setHoveredSlotInfo({ date, time, available, unavailable });
                    }}
                    onLeaveSlot={() => setHoveredSlotInfo(null)}
                    timezone={timezone}
                    compact
                  />
                </div>
                {/* Hover detail panel - hidden on mobile */}
                <div className="hidden w-56 shrink-0 md:block">
                  <div className="sticky top-20 min-h-[200px] rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                    {hoveredSlotInfo ? (
                      <HoverDetailPanel
                        date={hoveredSlotInfo.date}
                        time={hoveredSlotInfo.time}
                        availableParticipants={hoveredSlotInfo.available}
                        unavailableParticipants={hoveredSlotInfo.unavailable}
                        totalParticipants={participantsWithAvailability.length}
                      />
                    ) : (
                      <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        <p>Hover over a time slot to see who&apos;s available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Party Members Section */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Party Members ({participants.length})
            </h2>
            {currentParticipant && !showAddPlayer && (
              <button
                onClick={() => setShowAddPlayer(true)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                + Add Player
              </button>
            )}
          </div>

          <div className="p-4">
            {/* Add Player Form */}
              {showAddPlayer && (
                <div className="mb-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                  <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Add a player to the campaign
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player name..."
                      className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
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
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isAddingPlayer ? "Adding..." : "Add"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPlayer(false);
                        setNewPlayerName("");
                      }}
                      className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {participants.length === 0 ? (
                <EmptyPartyList />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {participants.map((p) => {
                    const isCurrentUser = currentParticipant?.id === p.id;

                    return (
                      <div
                        key={p.id}
                        className="group relative rounded-lg border border-zinc-200 bg-zinc-50 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-750"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(p)}
                          className="flex w-full items-start gap-3 p-3 text-left"
                        >
                          {p.characterTokenBase64 ? (
                            <img
                              src={p.characterTokenBase64}
                              alt={p.characterName || p.displayName}
                              className="h-12 w-12 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                              {p.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {p.displayName}
                              </span>
                              {p.isGm && (
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                  GM
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-xs text-zinc-400">(you)</span>
                              )}
                            </div>
                            {p.characterName && (
                              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                                {p.characterName}
                                {p.characterClass && (
                                  <span className="text-zinc-400 dark:text-zinc-500"> · {p.characterClass}</span>
                                )}
                              </p>
                            )}
                            {p.notes && (
                              <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                                {p.notes}
                              </p>
                            )}
                          </div>
                          <svg className="h-5 w-5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {/* Remove button - visible on hover */}
                        {currentParticipant && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePlayer(p.id, p.displayName);
                            }}
                            className="absolute right-1 top-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                            title={`Remove ${p.displayName}`}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>

        {/* Spacer for fixed CTA banner */}
        <div className="h-16" />
      </div>

      {/* Floating Glass CTAs */}
      {/* Join CTA for non-registered users */}
      {!currentParticipant && (
        <FloatingGlassCta>
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-white">Join the Party!</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                    {isAtCapacity
                      ? `Campaign at capacity (${playerCount}/${event.maxPlayers})`
                      : "Set your availability and join this campaign"}
                  </p>
                </div>
              </div>
              <div className="sm:shrink-0">
                <JoinEventForm
                  eventSlug={event.slug}
                  onJoined={handleJoined}
                  hasGm={hasGm}
                  compact
                />
              </div>
            </div>
          </div>
        </FloatingGlassCta>
      )}

      {/* GM invite CTA - highest priority for GMs with no players */}
      {currentParticipant?.isGm && playerCount === 0 && (
        <FloatingGlassCta>
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-white">Campaign Ready!</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">Invite players to join your campaign</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <a
                  href={`/${event.slug}/gm`}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                >
                  Edit Availability
                </a>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 transition-all"
                >
                  {copiedLink ? (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </FloatingGlassCta>
      )}

      {/* Status CTA for registered users - always show edit options */}
      {currentParticipant && !(currentParticipant.isGm && playerCount === 0) && (
        <FloatingGlassCta>
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    Joined as {currentParticipant.displayName}
                    {currentParticipant.isGm && " (GM)"}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">You&apos;re part of this campaign</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                {!currentParticipant.isGm && (
                  <a
                    href={`/${event.slug}/${currentParticipant.id}/character`}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                  >
                    Edit Character
                  </a>
                )}
                <a
                  href={currentParticipant.isGm ? `/${event.slug}/gm` : `/${event.slug}/${currentParticipant.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all"
                >
                  Edit Availability
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </FloatingGlassCta>
      )}

      <Footer />

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

      {/* Remove Player Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!playerToRemove}
        onClose={() => setPlayerToRemove(null)}
        onConfirm={executeRemovePlayer}
        title="Remove Player"
        message={`Are you sure you want to remove ${playerToRemove?.name} from this campaign? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
      />
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
