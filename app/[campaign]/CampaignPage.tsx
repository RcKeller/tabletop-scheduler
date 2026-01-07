"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { startOfWeek, parseISO } from "date-fns";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import { JoinEventForm } from "@/components/participant/JoinEventForm";
import { CombinedHeatmap } from "@/components/heatmap/CombinedHeatmap";
import { WeekNavigator } from "@/components/navigation/WeekNavigator";
import type { TimeSlot, MeetingType } from "@/lib/types";

interface GameSystem {
  id: string;
  name: string;
  imageBase64: string | null;
}

interface Participant {
  id: string;
  displayName: string;
  isGm: boolean;
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
      const found = event.participants.find((p) => p.id === storedId);
      if (found) {
        setCurrentParticipant(found);
      }
    }
  }, [event.id, event.participants]);

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section with Campaign Image */}
      <div className="relative">
        {event.campaignImageBase64 ? (
          <div className="aspect-[16/9] max-h-[400px] w-full overflow-hidden">
            <img
              src={event.campaignImageBase64}
              alt={event.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-blue-600 to-purple-700" />
        )}

        {/* Campaign Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-end gap-2">
              {event.gameSystem?.imageBase64 && !event.campaignImageBase64 && (
                <img
                  src={event.gameSystem.imageBase64}
                  alt={event.gameSystem.name}
                  className="h-16 w-16 rounded-lg border-2 border-white/20 object-cover shadow-lg"
                />
              )}
              <div>
                {event.gameSystem && (
                  <p className="text-sm font-medium text-white/80">
                    {event.gameSystem.name}
                  </p>
                )}
                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  {event.title}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-3">
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Main Column */}
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

            {/* Group Availability */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
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
                  <div className="flex h-48 items-center justify-center">
                    <p className="text-sm text-zinc-500">Loading...</p>
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
                  />
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
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
                      <p className="text-xs text-zinc-500">You're in this campaign</p>
                    </div>
                  </div>
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
                    Join This Campaign
                  </h2>
                  <JoinEventForm
                    eventSlug={event.slug}
                    onJoined={handleJoined}
                  />
                </div>
              )}
            </div>

            {/* Session Info */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Session Details
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Session Length</span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {Math.floor(event.sessionLengthMinutes / 60)}h {event.sessionLengthMinutes % 60 > 0 ? `${event.sessionLengthMinutes % 60}m` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Time Window</span>
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {formatTime(event.earliestTime)} - {formatTime(event.latestTime)}
                  </span>
                </div>
                {meetingInfo && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Platform</span>
                    <span className="text-zinc-900 dark:text-zinc-100">{meetingInfo.type}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Party Members */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Party ({event.participants.length})
              </h2>
              {event.participants.length === 0 ? (
                <p className="text-sm text-zinc-500">No players yet</p>
              ) : (
                <div className="space-y-2">
                  {event.participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {p.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {p.displayName}
                      </span>
                      {p.isGm && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          GM
                        </span>
                      )}
                      {currentParticipant?.id === p.id && (
                        <span className="text-xs text-zinc-400">(you)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Share Link */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Share
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
      </div>

      {/* Footer */}
      <footer className="mt-4 border-t border-zinc-200 py-2 text-center text-xs text-zinc-500 dark:border-zinc-800">
        When2Play
      </footer>
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
