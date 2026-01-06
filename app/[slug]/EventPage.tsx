"use client";

import { useState, useEffect, useCallback } from "react";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import { JoinEventForm } from "@/components/participant/JoinEventForm";
import { ParticipantList } from "@/components/participant/ParticipantList";
import { AvailabilitySection } from "@/components/availability/AvailabilitySection";
import { OverlapPreview } from "@/components/overlap/OverlapPreview";
import { getBrowserTimezone } from "@/lib/utils/timezone";
import type { Event, Participant } from "@/lib/types";

interface EventPageProps {
  event: Event;
}

export function EventPage({ event }: EventPageProps) {
  const [timezone, setTimezone] = useState(event.timezone);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load participants
  useEffect(() => {
    async function loadParticipants() {
      try {
        const res = await fetch(`/api/events/${event.slug}/participants`);
        if (res.ok) {
          const data = await res.json();
          setParticipants(data);
        }
      } catch (error) {
        console.error("Failed to load participants:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadParticipants();
  }, [event.slug, refreshKey]);

  // Check for stored participant ID
  useEffect(() => {
    const storedId = localStorage.getItem(`participant_${event.id}`);
    if (storedId && participants.length > 0) {
      const found = participants.find((p) => p.id === storedId);
      if (found) {
        setCurrentParticipant(found);
      }
    }
  }, [event.id, participants]);

  const handleJoined = useCallback((participant: Participant) => {
    localStorage.setItem(`participant_${event.id}`, participant.id);
    setCurrentParticipant(participant);
    setRefreshKey((k) => k + 1);
  }, [event.id]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleTimezoneChange = useCallback((tz: string) => {
    setTimezone(tz);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {event.title}
              </h1>
              {event.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {event.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Timezone:
              </span>
              <TimezoneSelector
                value={timezone}
                onChange={handleTimezoneChange}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Main content */}
            <div className="space-y-6">
              {/* Join or Availability Section */}
              {!currentParticipant ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    Join this session
                  </h2>
                  <JoinEventForm
                    eventSlug={event.slug}
                    onJoined={handleJoined}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                      Your Availability
                    </h2>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Logged in as{" "}
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {currentParticipant.displayName}
                      </span>
                      {currentParticipant.isGm && (
                        <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          GM
                        </span>
                      )}
                    </span>
                  </div>
                  <AvailabilitySection
                    participant={currentParticipant}
                    timezone={timezone}
                    onUpdate={handleRefresh}
                  />
                </div>
              )}

              {/* Participants list */}
              <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    Party Members ({participants.length})
                  </h2>
                  <button
                    onClick={handleRefresh}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Refresh
                  </button>
                </div>
                {isLoading ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Loading...
                  </p>
                ) : (
                  <ParticipantList
                    participants={participants}
                    currentParticipantId={currentParticipant?.id}
                  />
                )}
              </div>
            </div>

            {/* Sidebar - Overlap Preview */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  Best Times
                </h2>
                <OverlapPreview
                  eventSlug={event.slug}
                  timezone={timezone}
                  refreshKey={refreshKey}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Share this link:{" "}
          <code className="rounded bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {typeof window !== "undefined" ? window.location.href : `/${event.slug}`}
          </code>
        </div>
      </footer>
    </div>
  );
}
