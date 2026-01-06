"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addMonths } from "date-fns";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import { getBrowserTimezone } from "@/lib/utils/timezone";
import { GameSystemAutocomplete } from "./GameSystemAutocomplete";
import { GameSystemModal } from "./GameSystemModal";
import { ImageUpload } from "./ImageUpload";
import { SessionLengthSelector } from "./SessionLengthSelector";
import { DateRangePicker } from "./DateRangePicker";
import { TimeWindowSelector } from "./TimeWindowSelector";
import { MeetingTypeSelector } from "./MeetingTypeSelector";
import { PreSessionInstructions } from "./PreSessionInstructions";
import type { GameSystem, MeetingType } from "@/lib/types";

export function CreateCampaignForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGameSystemModalOpen, setIsGameSystemModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameSystem, setGameSystem] = useState<GameSystem | null>(null);
  const [campaignImageBase64, setCampaignImageBase64] = useState<string | null>(null);
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(180);
  const [timezone, setTimezone] = useState(getBrowserTimezone());
  const [startDate, setStartDate] = useState<string | null>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string | null>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [earliestTime, setEarliestTime] = useState("17:00"); // 5 PM
  const [latestTime, setLatestTime] = useState("23:00"); // 11 PM
  const [meetingType, setMeetingType] = useState<MeetingType | null>(null);
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingRoom, setMeetingRoom] = useState("");
  const [preSessionInstructions, setPreSessionInstructions] = useState("");

  // Update pre-session instructions when game system changes
  useEffect(() => {
    if (gameSystem?.defaultInstructions) {
      setPreSessionInstructions(gameSystem.defaultInstructions);
    }
  }, [gameSystem]);

  const handleGameSystemCreated = useCallback((system: GameSystem) => {
    setGameSystem(system);
  }, []);

  const handleTimezoneChange = useCallback((tz: string) => {
    setTimezone(tz);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!title.trim()) {
        throw new Error("Campaign name is required");
      }
      if (!startDate || !endDate) {
        throw new Error("Date range is required");
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        timezone,
        gameSystemId: gameSystem?.id || undefined,
        campaignImageBase64: campaignImageBase64 || undefined,
        sessionLengthMinutes,
        customPreSessionInstructions: preSessionInstructions.trim() || undefined,
        startDate,
        endDate,
        earliestTime,
        latestTime,
        meetingType: meetingType || undefined,
        meetingLocation: meetingLocation.trim() || undefined,
        meetingRoom: meetingRoom.trim() || undefined,
      };

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create campaign");
      }

      const event = await response.json();
      router.push(`/${event.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Basic Info Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Basic Info
          </h3>

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Campaign Name *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Curse of Strahd"
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your campaign..."
              rows={2}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </section>

        {/* Game System Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Game System
          </h3>

          <GameSystemAutocomplete
            value={gameSystem}
            onChange={setGameSystem}
            onCreateNew={() => setIsGameSystemModalOpen(true)}
          />

          <ImageUpload
            value={campaignImageBase64}
            onChange={setCampaignImageBase64}
            label="Campaign Image (optional)"
          />
        </section>

        {/* Session Details Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Session Details
          </h3>

          <SessionLengthSelector
            value={sessionLengthMinutes}
            onChange={setSessionLengthMinutes}
          />
        </section>

        {/* Meeting Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Meeting
          </h3>

          <MeetingTypeSelector
            meetingType={meetingType}
            meetingLocation={meetingLocation}
            meetingRoom={meetingRoom}
            onMeetingTypeChange={setMeetingType}
            onMeetingLocationChange={setMeetingLocation}
            onMeetingRoomChange={setMeetingRoom}
          />
        </section>

        {/* Scheduling Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Scheduling
          </h3>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Default Timezone
            </label>
            <div className="mt-1">
              <TimezoneSelector
                value={timezone}
                onChange={handleTimezoneChange}
                className="w-full"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Players can view in their own timezone
            </p>
          </div>

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          <TimeWindowSelector
            earliestTime={earliestTime}
            latestTime={latestTime}
            onEarliestChange={setEarliestTime}
            onLatestChange={setLatestTime}
          />
        </section>

        {/* Pre-Session Instructions Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Instructions
          </h3>

          <PreSessionInstructions
            value={preSessionInstructions}
            defaultValue={gameSystem?.defaultInstructions || ""}
            onChange={setPreSessionInstructions}
          />
        </section>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !startDate || !endDate}
          className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Creating Campaign..." : "Create Campaign"}
        </button>
      </form>

      <GameSystemModal
        isOpen={isGameSystemModalOpen}
        onClose={() => setIsGameSystemModalOpen(false)}
        onCreated={handleGameSystemCreated}
      />
    </>
  );
}
