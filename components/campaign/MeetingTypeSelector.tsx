"use client";

import { useMemo } from "react";
import { MEETING_TYPE_CONFIG, type MeetingType } from "@/lib/types";

interface MeetingTypeSelectorProps {
  meetingType: MeetingType | null;
  meetingLocation: string;
  meetingRoom: string;
  onMeetingTypeChange: (type: MeetingType | null) => void;
  onMeetingLocationChange: (location: string) => void;
  onMeetingRoomChange: (room: string) => void;
  className?: string;
}

export function MeetingTypeSelector({
  meetingType,
  meetingLocation,
  meetingRoom,
  onMeetingTypeChange,
  onMeetingLocationChange,
  onMeetingRoomChange,
  className = "",
}: MeetingTypeSelectorProps) {
  const config = useMemo(() => {
    return meetingType
      ? MEETING_TYPE_CONFIG.find((c) => c.value === meetingType)
      : null;
  }, [meetingType]);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Meeting Information
      </label>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Where will the campaign sessions take place?
      </p>

      <div className="mt-2 space-y-3">
        <div>
          <label
            htmlFor="meetingType"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Meeting Type
          </label>
          <select
            id="meetingType"
            value={meetingType || ""}
            onChange={(e) =>
              onMeetingTypeChange(
                e.target.value ? (e.target.value as MeetingType) : null
              )
            }
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Select a meeting type...</option>
            {MEETING_TYPE_CONFIG.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {meetingType && config && (
          <>
            <div>
              <label
                htmlFor="meetingLocation"
                className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
              >
                {config.locationLabel}
              </label>
              <input
                type={meetingType === "IN_PERSON" ? "text" : "url"}
                id="meetingLocation"
                value={meetingLocation}
                onChange={(e) => onMeetingLocationChange(e.target.value)}
                placeholder={config.locationPlaceholder}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label
                htmlFor="meetingRoom"
                className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
              >
                {config.roomLabel}
              </label>
              <input
                type="text"
                id="meetingRoom"
                value={meetingRoom}
                onChange={(e) => onMeetingRoomChange(e.target.value)}
                placeholder={config.roomPlaceholder}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
