"use client";

import Link from "next/link";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { TimezoneProvider } from "@/components/availability/TimezoneContext";

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

interface AvailabilityPageClientProps {
  event: EventData;
  participant: ParticipantData;
  campaignSlug: string;
}

export function AvailabilityPageClient({
  event,
  participant,
  campaignSlug,
}: AvailabilityPageClientProps) {
  return (
    <TimezoneProvider initialTimezone={participant.timezone}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/${campaignSlug}`}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to Campaign
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 mt-1">
                  {event.title}
                </h1>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-500">Editing as</div>
                <div className="font-medium text-gray-900">
                  {participant.displayName}
                  {participant.isGm && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      GM
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <AvailabilityEditor
              participantId={participant.id}
              event={event}
              isGm={participant.isGm}
            />
          </div>

          {/* Info section */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="font-medium text-blue-900 mb-2">
              {participant.isGm ? "GM Tips" : "Player Tips"}
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              {participant.isGm ? (
                <>
                  <li>
                    • Set your recurring availability to define when you can run
                    sessions
                  </li>
                  <li>
                    • Players will see your availability as the "playable window"
                  </li>
                  <li>
                    • Use the AI input to quickly add complex schedules (e.g.,
                    "weekday evenings 6-10pm")
                  </li>
                </>
              ) : (
                <>
                  <li>
                    • Click and drag to select time slots when you're available
                  </li>
                  <li>
                    • The GM will see everyone's availability combined on a
                    heatmap
                  </li>
                  <li>
                    • You can use natural language to describe your schedule
                    (e.g., "free weekends")
                  </li>
                </>
              )}
            </ul>
          </div>
        </main>
      </div>
    </TimezoneProvider>
  );
}
