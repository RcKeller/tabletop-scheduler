"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseISO, format } from "date-fns";
import { JoinEventForm } from "@/components/participant/JoinEventForm";
import { VirtualizedAvailabilityGrid } from "@/components/availability/VirtualizedAvailabilityGrid";
import { PlayerDetailModal } from "@/components/participant/PlayerDetailModal";
import { CampaignHeader, HeroInfoCard } from "@/components/campaign/CampaignHeader";
import { Footer } from "@/components/layout/Footer";
import { EmptyHeatmap } from "@/components/empty-states/EmptyHeatmap";
import { FloatingGlassCta, InviteCta } from "@/components/ui/FloatingGlassCta";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useTimezone } from "@/components/layout/TimezoneProvider";
import type { MeetingType, CampaignType, Participant, ParticipantWithAvailability } from "@/lib/types";
import { convertDateTime } from "@/lib/utils/timezone";
import { fromZonedTime } from "date-fns-tz";
import { parse } from "date-fns";

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

  // Hovered slot info for the hover panel - enhanced for session-length awareness
  const [hoveredSlotInfo, setHoveredSlotInfo] = useState<{
    date: string;
    time: string;
    sessionEndTime: string;
    // Players fully available for entire session
    fullyAvailable: { id: string; name: string }[];
    // Players partially available (with their available time range)
    partiallyAvailable: { id: string; name: string; availableFrom: string; availableTo: string; coverageMinutes: number }[];
    // Players not available at all during the session
    unavailable: { id: string; name: string }[];
  } | null>(null);

  // Check for stored participant ID and sync isGm status
  useEffect(() => {
    const storedId = localStorage.getItem(`participant_${event.id}`);
    if (storedId) {
      const found = participants.find((p) => p.id === storedId);
      if (found) {
        setCurrentParticipant(found);
        // Sync isGm status to localStorage (for navbar to read)
        localStorage.setItem(`participant_${event.id}_isGm`, found.isGm ? "true" : "false");
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
    localStorage.setItem(`participant_${event.id}_isGm`, participant.isGm ? "true" : "false");
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

  // Format session length for display
  const formatSessionLength = () => {
    const mins = event.sessionLengthMinutes;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section with Campaign Image */}
      <CampaignHeader
        title={event.title}
        campaignImageBase64={event.campaignImageBase64}
        gameSystem={event.gameSystem}
        description={event.description}
      >
        {/* Quick info cards in hero */}
        <HeroInfoCard
          icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Session"
          value={formatSessionLength()}
        />
        <HeroInfoCard
          icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          label="Party"
          value={event.minPlayers || event.maxPlayers
            ? `${event.minPlayers || 1}–${event.maxPlayers || "∞"} players`
            : `${participants.length} member${participants.length !== 1 ? 's' : ''}`
          }
        />
        {meetingInfo && (
          <HeroInfoCard
            icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
            label="Platform"
            value={meetingInfo.type}
          />
        )}
      </CampaignHeader>

      {/* Main Content - Centered single column, all sections stacked */}
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Meeting location info (if applicable) */}
        {meetingInfo && (meetingInfo.location || meetingInfo.room) && (
          <div className="flex items-center gap-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 px-4 py-3">
            <svg className="h-5 w-5 text-zinc-500 dark:text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">{meetingInfo.type}: </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {meetingInfo.location}
                {meetingInfo.room && ` · ${meetingInfo.room}`}
              </span>
            </div>
          </div>
        )}

        {/* Pre-session instructions - gentle style */}
        {event.customPreSessionInstructions && (
          <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                  Before you play
                </h3>
                <p className="whitespace-pre-wrap text-sm text-blue-800/80 dark:text-blue-300/70 leading-relaxed">
                  {event.customPreSessionInstructions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Group Availability Section */}
        <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Group Availability
                </h2>
                {!isLoading && gmHasAvailability && gmAvailability && gmAvailability.earliestTime && gmAvailability.latestTime && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {gmParticipant?.displayName} (GM) is available {(() => {
                      const refDate = format(eventStartDate, "yyyy-MM-dd");
                      const localEarliest = gmAvailability.timezone !== timezone
                        ? convertDateTime(gmAvailability.earliestTime, refDate, gmAvailability.timezone, timezone).time
                        : gmAvailability.earliestTime;
                      const localLatest = gmAvailability.timezone !== timezone
                        ? convertDateTime(gmAvailability.latestTime, refDate, gmAvailability.timezone, timezone).time
                        : gmAvailability.latestTime;
                      return `${formatTime(localEarliest)}–${formatTime(localLatest)}`;
                    })()}
                  </p>
                )}
              </div>
            </div>
            {/* Show Full Day toggle */}
            {!isLoading && gmHasAvailability && (
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Full day</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showFullDay}
                    onChange={(e) => setShowFullDay(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-zinc-200 transition-colors peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/20 dark:bg-zinc-700 dark:peer-checked:bg-blue-600" />
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            )}
          </div>
          {isLoading ? (
            <div className="p-4">
              <div className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height: "300px" }} />
            </div>
          ) : participantsWithAvailability.length === 0 ? (
            <div className="p-4">
              <EmptyHeatmap hasPlayers={participants.length > 0} />
            </div>
          ) : (
            <div className="flex gap-0 pb-2">
              {/* Heatmap grid - no padding */}
              <div className="flex-1 min-w-0">
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
                  onHoverSlot={(date, time) => {
                    // Calculate session coverage for all participants
                    // Note: date and time are in user's display timezone, availability is in UTC
                    const sessionEndTime = addMinutes(time, event.sessionLengthMinutes);
                    const coverage = calculateSessionCoverage(
                      time,
                      date,
                      event.sessionLengthMinutes,
                      participantsWithAvailability,
                      timezone // Pass user's timezone for proper conversion
                    );
                    setHoveredSlotInfo({
                      date,
                      time,
                      sessionEndTime,
                      fullyAvailable: coverage.fullyAvailable,
                      partiallyAvailable: coverage.partiallyAvailable,
                      unavailable: coverage.unavailable,
                    });
                  }}
                  onLeaveSlot={() => setHoveredSlotInfo(null)}
                  timezone={timezone}
                />
              </div>

              {/* Party sidebar with live availability highlighting - hidden on mobile */}
              <div className="hidden w-52 shrink-0 md:block border-l border-zinc-100 dark:border-zinc-800">
                <div className="sticky top-20 p-3">
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Party
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {hoveredSlotInfo
                          ? `${hoveredSlotInfo.fullyAvailable.length}/${participants.length}`
                          : participants.length}
                      </span>
                    </div>
                    {/* Show session time range when hovering */}
                    {hoveredSlotInfo && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">
                          {formatTime(hoveredSlotInfo.time)}–{formatTime(hoveredSlotInfo.sessionEndTime)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    {participants.map((p) => {
                      const isHovering = !!hoveredSlotInfo;
                      const isFullyAvailable = hoveredSlotInfo?.fullyAvailable.some(a => a.id === p.id);
                      const partialInfo = hoveredSlotInfo?.partiallyAvailable.find(a => a.id === p.id);
                      const isPartiallyAvailable = !!partialInfo;

                      // Determine subtitle text: character name, "No character yet", or partial availability warning
                      let subtitleText = p.characterName || (p.isGm ? null : "No character yet");
                      let subtitleStyle = "text-zinc-400 dark:text-zinc-500 italic";

                      if (isHovering && isPartiallyAvailable && partialInfo) {
                        // Show partial availability warning instead
                        const coverageHours = Math.floor(partialInfo.coverageMinutes / 60);
                        const coverageMins = partialInfo.coverageMinutes % 60;
                        const coverageStr = coverageHours > 0
                          ? coverageMins > 0 ? `${coverageHours}h ${coverageMins}m` : `${coverageHours}h`
                          : `${coverageMins}m`;
                        subtitleText = `Only ${coverageStr} available`;
                        subtitleStyle = "text-amber-600 dark:text-amber-400";
                      }

                      return (
                        <button
                          key={p.id}
                          onClick={() => handleOpenProfile(p)}
                          className={`group flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-all ${
                            isHovering
                              ? isFullyAvailable
                                ? "bg-green-50 ring-1 ring-green-200 dark:bg-green-900/20 dark:ring-green-800"
                                : isPartiallyAvailable
                                  ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-800"
                                  : "opacity-40"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {p.characterTokenBase64 ? (
                              <img
                                src={p.characterTokenBase64}
                                alt={p.characterName || p.displayName}
                                className="h-8 w-8 rounded-lg object-cover"
                              />
                            ) : (
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                                p.isGm
                                  ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                              }`}>
                                {p.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {p.isGm && (
                              <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-purple-600 ring-1 ring-white dark:ring-zinc-900">
                                <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            {/* Status indicator */}
                            {isHovering && isFullyAvailable && (
                              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-1 ring-white dark:ring-zinc-900" />
                            )}
                            {isHovering && isPartiallyAvailable && (
                              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-1 ring-white dark:ring-zinc-900" />
                            )}
                          </div>

                          {/* Name and subtitle - consistent height layout */}
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium leading-tight ${
                              isHovering && isFullyAvailable
                                ? "text-green-700 dark:text-green-300"
                                : isHovering && isPartiallyAvailable
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-zinc-700 dark:text-zinc-300"
                            }`}>
                              {p.displayName}
                            </p>
                            {/* Subtitle: always reserve space for consistent height */}
                            <p className={`truncate text-xs leading-tight h-4 ${subtitleStyle}`}>
                              {subtitleText || "\u00A0"}
                            </p>
                          </div>

                          {/* Warning icon for partial availability */}
                          {isHovering && isPartiallyAvailable && (
                            <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Player - compact version */}
                  {currentParticipant && (
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      {showAddPlayer ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            placeholder="Player name"
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newPlayerName.trim()) handleAddPlayer();
                              if (e.key === "Escape") {
                                setShowAddPlayer(false);
                                setNewPlayerName("");
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={handleAddPlayer}
                              disabled={isAddingPlayer || !newPlayerName.trim()}
                              className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isAddingPlayer ? "..." : "Add"}
                            </button>
                            <button
                              onClick={() => {
                                setShowAddPlayer(false);
                                setNewPlayerName("");
                              }}
                              className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddPlayer(true)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Player
                        </button>
                      )}
                    </div>
                  )}

                  {/* Hover hint when no slot selected */}
                  {!hoveredSlotInfo && participants.length > 0 && (
                    <p className="mt-3 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
                      Hover a time slot to see availability
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
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
        <InviteCta
          campaignSlug={event.slug}
          onCopyLink={handleCopyLink}
          linkCopied={copiedLink}
        />
      )}

      {/* Status CTA for registered users - always show edit options */}
      {currentParticipant && !(currentParticipant.isGm && playerCount === 0) && (
        <FloatingGlassCta>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-white text-sm">
                  Joined as {currentParticipant.displayName}
                  {currentParticipant.isGm && " (GM)"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">You&apos;re part of this campaign</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Only show character edit if there are pre-session instructions */}
              {!currentParticipant.isGm && event.customPreSessionInstructions && (
                <a
                  href={`/${event.slug}/${currentParticipant.id}/character`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Edit Character
                </a>
              )}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {copiedLink ? "Copied!" : "Share"}
              </button>
              <a
                href={currentParticipant.isGm ? `/${event.slug}/gm` : `/${event.slug}/${currentParticipant.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 transition-all"
              >
                Edit Availability
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
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

function addMinutes(time: string, minutes: number): string {
  const [hourStr, minuteStr] = time.split(":");
  let totalMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr) + minutes;
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Convert a date+time from one timezone to UTC, returning absolute minutes since epoch
function dateTimeToAbsoluteMinutes(date: string, time: string, fromTz: string): number {
  if (fromTz === "UTC") {
    const d = new Date(`${date}T${time}:00Z`);
    return d.getTime() / (60 * 1000);
  }
  // Parse as a local time in the given timezone and convert to UTC milliseconds
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return utcDate.getTime() / (60 * 1000);
}

// Calculate session coverage for all participants given a session start time and duration
// sessionStart and sessionDate are in userTimezone, participant availability is in UTC
function calculateSessionCoverage(
  sessionStart: string,
  sessionDate: string,
  sessionLengthMinutes: number,
  participants: { id: string; name: string; availability: { date: string; startTime: string; endTime: string }[] }[],
  userTimezone: string
): {
  fullyAvailable: { id: string; name: string }[];
  partiallyAvailable: { id: string; name: string; availableFrom: string; availableTo: string; coverageMinutes: number }[];
  unavailable: { id: string; name: string }[];
} {
  // Convert session window from user timezone to absolute minutes
  const sessionStartAbsolute = dateTimeToAbsoluteMinutes(sessionDate, sessionStart, userTimezone);
  const sessionEndAbsolute = sessionStartAbsolute + sessionLengthMinutes;

  const fullyAvailable: { id: string; name: string }[] = [];
  const partiallyAvailable: { id: string; name: string; availableFrom: string; availableTo: string; coverageMinutes: number }[] = [];
  const unavailable: { id: string; name: string }[] = [];

  for (const participant of participants) {
    // Convert all participant availability slots to absolute minutes (they're stored in UTC)
    const availSlots = participant.availability
      .map(slot => {
        const startAbsolute = dateTimeToAbsoluteMinutes(slot.date, slot.startTime, "UTC");
        let endAbsolute = dateTimeToAbsoluteMinutes(slot.date, slot.endTime, "UTC");
        // Handle overnight slots where endTime < startTime
        if (endAbsolute <= startAbsolute && slot.endTime !== slot.startTime) {
          endAbsolute += 24 * 60; // Add a day
        }
        return { startAbsolute, endAbsolute };
      })
      .filter(slot => slot.endAbsolute > slot.startAbsolute);

    if (availSlots.length === 0) {
      unavailable.push({ id: participant.id, name: participant.name });
      continue;
    }

    // Calculate coverage within the session window
    let coveredMinutes = 0;
    let earliestCoveredAbsolute = sessionEndAbsolute;
    let latestCoveredAbsolute = sessionStartAbsolute;

    // Check each 30-minute slot in the session
    for (let slotStartAbs = sessionStartAbsolute; slotStartAbs < sessionEndAbsolute; slotStartAbs += 30) {
      const slotEndAbs = slotStartAbs + 30;

      // Check if this slot is covered by any availability
      const isCovered = availSlots.some(avail =>
        avail.startAbsolute <= slotStartAbs && avail.endAbsolute >= slotEndAbs
      );

      if (isCovered) {
        coveredMinutes += 30;
        if (slotStartAbs < earliestCoveredAbsolute) earliestCoveredAbsolute = slotStartAbs;
        if (slotEndAbs > latestCoveredAbsolute) latestCoveredAbsolute = slotEndAbs;
      }
    }

    if (coveredMinutes === 0) {
      unavailable.push({ id: participant.id, name: participant.name });
    } else if (coveredMinutes >= sessionLengthMinutes) {
      fullyAvailable.push({ id: participant.id, name: participant.name });
    } else {
      // Partially available - calculate their available window relative to session start
      const offsetFromSessionStart = earliestCoveredAbsolute - sessionStartAbsolute;
      const coverageDuration = latestCoveredAbsolute - earliestCoveredAbsolute;
      partiallyAvailable.push({
        id: participant.id,
        name: participant.name,
        // Convert back to display time relative to session start
        availableFrom: addMinutes(sessionStart, offsetFromSessionStart),
        availableTo: addMinutes(sessionStart, offsetFromSessionStart + coverageDuration),
        coverageMinutes: coveredMinutes,
      });
    }
  }

  return { fullyAvailable, partiallyAvailable, unavailable };
}
