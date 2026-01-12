"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import { TimezoneAutocomplete } from "@/components/timezone/TimezoneAutocomplete";
import { JoinEventForm } from "@/components/participant/JoinEventForm";
import { VirtualizedAvailabilityGrid } from "@/components/availability/VirtualizedAvailabilityGrid";
import { HoverDetailPanel } from "@/components/heatmap/HoverDetailPanel";
import { PlayerDetailModal } from "@/components/participant/PlayerDetailModal";
import { CampaignHeader } from "@/components/campaign/CampaignHeader";
import { Footer } from "@/components/layout/Footer";
import { EmptyPartyList } from "@/components/empty-states/EmptyPartyList";
import { EmptyHeatmap } from "@/components/empty-states/EmptyHeatmap";
import { CtaBanner } from "@/components/ui/CtaBanner";
import type { MeetingType, CampaignType, Participant, ParticipantWithAvailability } from "@/lib/types";
import { getBrowserTimezone } from "@/lib/utils/timezone";

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

  // Persist timezone globally in localStorage
  // Default to event.timezone for SSR, then update client-side
  const [timezone, setTimezoneState] = useState(event.timezone);

  // Load timezone from localStorage on mount, or default to browser timezone
  useEffect(() => {
    const stored = localStorage.getItem("when2play_timezone");
    if (stored) {
      setTimezoneState(stored);
    } else {
      // If no stored timezone, default to browser's local timezone (not event timezone)
      const browserTz = getBrowserTimezone();
      setTimezoneState(browserTz);
      localStorage.setItem("when2play_timezone", browserTz);
    }
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem("when2play_timezone", tz);
  }, []);
  const [participantsWithAvailability, setParticipantsWithAvailability] = useState<ParticipantWithAvailability[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(event.participants);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  // Handle removing a player
  const handleRemovePlayer = useCallback(async (participantId: string, displayName: string) => {
    if (!confirm(`Are you sure you want to remove ${displayName} from this campaign? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/participants/${participantId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setParticipants((prev) => prev.filter(p => p.id !== participantId));
        setParticipantsWithAvailability((prev) => prev.filter(p => p.id !== participantId));
        // Close profile modal if the removed player was being viewed
        if (selectedParticipant?.id === participantId) {
          setIsProfileModalOpen(false);
          setSelectedParticipant(null);
        }
        // Clear current participant if removed
        if (currentParticipant?.id === participantId) {
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
    }
  }, [selectedParticipant, currentParticipant, event.id]);

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
  const loadHeatmapData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.slug}/heatmap`);
      if (res.ok) {
        const data = await res.json();
        setParticipantsWithAvailability(data.participants);
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
    const playerSlug = encodeURIComponent(participant.displayName.toLowerCase().replace(/\s+/g, "-"));
    router.push(`/${event.slug}/${playerSlug}`);
  };

  const handleEditAvailability = () => {
    if (currentParticipant) {
      const playerSlug = encodeURIComponent(currentParticipant.displayName.toLowerCase().replace(/\s+/g, "-"));
      router.push(`/${event.slug}/${playerSlug}`);
    }
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
  const isOverCapacity = event.maxPlayers !== null && playerCount > event.maxPlayers;

  // Check if GM has set availability
  const gmHasAvailability = useMemo(() => {
    if (!gmParticipant) return false;
    const gmWithAvailability = participantsWithAvailability.find(p => p.id === gmParticipant.id);
    return gmWithAvailability && gmWithAvailability.availability.length > 0;
  }, [gmParticipant, participantsWithAvailability]);

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
                  {formatTime(event.earliestTime)} - {formatTime(event.latestTime)}
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
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Group Availability
            </span>
            <TimezoneAutocomplete
              value={timezone}
              onChange={setTimezone}
            />
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

            {isLoading ? (
              <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "300px" }} />
            ) : participantsWithAvailability.length === 0 ? (
              <EmptyHeatmap hasPlayers={participants.length > 0} />
            ) : (
              <div className="flex gap-4">
                <div className="flex-1">
                  <VirtualizedAvailabilityGrid
                    key={`heatmap-${timezone}`}
                    startDate={eventStartDate}
                    endDate={eventEndDate}
                    earliestTime={event.earliestTime}
                    latestTime={event.latestTime}
                    timeWindowTimezone={event.timezone}
                    mode="heatmap"
                    participants={participantsWithAvailability.map(p => ({
                      id: p.id,
                      name: p.name,
                      availability: p.availability,
                    }))}
                    onHoverSlot={(date, time, available, unavailable) => {
                      setHoveredSlotInfo({ date, time, available, unavailable });
                    }}
                    onLeaveSlot={() => setHoveredSlotInfo(null)}
                    timezone={timezone}
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

      {/* Contextual CTA Banners */}
      {/* Join CTA for non-registered users */}
      {!currentParticipant && (
        <CtaBanner
          message={isAtCapacity
            ? `Campaign at capacity (${playerCount}/${event.maxPlayers}), but you can still join`
            : "Join this campaign to set your availability"
          }
          variant="info"
        >
          <JoinEventForm
            eventSlug={event.slug}
            onJoined={handleJoined}
            hasGm={hasGm}
            compact
          />
        </CtaBanner>
      )}

      {/* GM invite CTA - highest priority for GMs with no players */}
      {currentParticipant?.isGm && playerCount === 0 && (
        <CtaBanner
          message="Your campaign is ready! Invite players to join"
          actionLabel={copiedLink ? "Link Copied!" : "Copy Invite Link"}
          onAction={handleCopyLink}
          secondaryActionLabel="Edit Availability"
          secondaryActionHref={`/${event.slug}/${encodeURIComponent(currentParticipant.displayName.toLowerCase().replace(/\s+/g, "-"))}`}
          variant="info"
        />
      )}

      {/* Status CTA for registered users - always show edit options */}
      {currentParticipant && !(currentParticipant.isGm && playerCount === 0) && (
        <CtaBanner
          message={`Joined as ${currentParticipant.displayName}${currentParticipant.isGm ? " (GM)" : ""}`}
          actionLabel="Edit Availability"
          actionHref={`/${event.slug}/${encodeURIComponent(currentParticipant.displayName.toLowerCase().replace(/\s+/g, "-"))}`}
          secondaryActionLabel={!currentParticipant.isGm ? "Edit Character" : undefined}
          secondaryActionHref={!currentParticipant.isGm
            ? `/${event.slug}/${encodeURIComponent(currentParticipant.displayName.toLowerCase().replace(/\s+/g, "-"))}/character`
            : undefined
          }
          variant="success"
        />
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
