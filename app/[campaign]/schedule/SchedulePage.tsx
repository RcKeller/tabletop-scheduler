"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MeetingType } from "@/lib/types";
import { DateRangePicker } from "@/components/campaign/DateRangePicker";
import { TimeWindowSelector } from "@/components/campaign/TimeWindowSelector";
import { SessionLengthSelector } from "@/components/campaign/SessionLengthSelector";
import { MeetingTypeSelector } from "@/components/campaign/MeetingTypeSelector";

interface EventData {
  id: string;
  slug: string;
  title: string;
  campaignType: string;
  startDate: string | null;
  endDate: string | null;
  earliestTime: string;
  latestTime: string;
  sessionLengthMinutes: number;
  meetingType: MeetingType | null;
  meetingLocation: string | null;
  meetingRoom: string | null;
}

interface SchedulePageProps {
  event: EventData;
}

export function SchedulePage({ event }: SchedulePageProps) {
  const router = useRouter();

  // Form state
  const [startDate, setStartDate] = useState<string | null>(event.startDate);
  const [endDate, setEndDate] = useState<string | null>(event.endDate);
  const [earliestTime, setEarliestTime] = useState(event.earliestTime);
  const [latestTime, setLatestTime] = useState(event.latestTime);
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(event.sessionLengthMinutes);
  const [meetingType, setMeetingType] = useState<MeetingType | null>(event.meetingType);
  const [meetingLocation, setMeetingLocation] = useState(event.meetingLocation || "");
  const [meetingRoom, setMeetingRoom] = useState(event.meetingRoom || "");

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save and continue
  const handleContinue = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        startDate,
        endDate,
        earliestTime,
        latestTime,
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

      // Done - go to campaign page
      router.push(`/${event.slug}`);
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
          {/* Step indicator - hyperlinked */}
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
            <div className="h-px w-6 bg-green-400 dark:bg-green-600" />
            <Link
              href={`/${event.slug}/settings`}
              className="flex items-center gap-1 transition-colors hover:opacity-80"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs font-medium text-white">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Details</span>
            </Link>
            <div className="h-px w-6 bg-blue-400 dark:bg-blue-600" />
            <div className="flex items-center gap-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                3
              </div>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Schedule</span>
            </div>
            <div className="h-px w-6 bg-zinc-300 dark:bg-zinc-700" />
            <Link
              href={`/${event.slug}`}
              className="flex items-center gap-1 transition-colors hover:opacity-80"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                4
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Share</span>
            </Link>
          </nav>

          <h1 className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Schedule & Location
          </h1>
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            When and where will you play?
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="space-y-6">
          {/* Schedule Settings - consolidated */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              maxRangeMonths={event.campaignType === "ONESHOT" ? 1 : 3}
            />

            <div className="my-4 border-t border-zinc-200 dark:border-zinc-700" />

            <TimeWindowSelector
              earliestTime={earliestTime}
              latestTime={latestTime}
              onEarliestChange={setEarliestTime}
              onLatestChange={setLatestTime}
            />

            <div className="my-4 border-t border-zinc-200 dark:border-zinc-700" />

            <SessionLengthSelector
              value={sessionLengthMinutes}
              onChange={setSessionLengthMinutes}
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              How long is a typical session? This helps find time slots where everyone is free.
            </p>
          </div>

          {/* Meeting Info */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <MeetingTypeSelector
              meetingType={meetingType}
              meetingLocation={meetingLocation}
              meetingRoom={meetingRoom}
              onMeetingTypeChange={setMeetingType}
              onMeetingLocationChange={setMeetingLocation}
              onMeetingRoomChange={setMeetingRoom}
            />
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
            href={`/${event.slug}/settings`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Finish Setup"}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
