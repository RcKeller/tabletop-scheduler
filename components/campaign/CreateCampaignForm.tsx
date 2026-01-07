"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addMonths } from "date-fns";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import { getBrowserTimezone } from "@/lib/utils/timezone";
import { GameSystemAutocomplete } from "./GameSystemAutocomplete";
import { ImageUpload } from "./ImageUpload";
import { SessionLengthSelector } from "./SessionLengthSelector";
import { DateRangePicker } from "./DateRangePicker";
import { TimeWindowSelector } from "./TimeWindowSelector";
import type { GameSystem, MeetingType, PrepUrl } from "@/lib/types";

const MEETING_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: "DISCORD", label: "Discord" },
  { value: "ZOOM", label: "Zoom" },
  { value: "GOOGLE_MEET", label: "Google Meet" },
  { value: "ROLL20", label: "Roll20" },
  { value: "FOUNDRY_VTT", label: "Foundry VTT" },
  { value: "IN_PERSON", label: "In-Person" },
  { value: "OTHER", label: "Other" },
];

const LINK_TYPE_OPTIONS = [
  { value: "rules", label: "Rules Reference" },
  { value: "character", label: "Character Builder" },
  { value: "wiki", label: "Campaign Wiki" },
  { value: "discord", label: "Discord Server" },
  { value: "other", label: "Other" },
];

const getMeetingConfig = (type: MeetingType) => {
  const configs: Record<MeetingType, { locationLabel: string; locationPlaceholder: string; roomLabel: string; roomPlaceholder: string }> = {
    DISCORD: { locationLabel: "Server Invite", locationPlaceholder: "https://discord.gg/...", roomLabel: "Voice Channel", roomPlaceholder: "#voice-chat" },
    ZOOM: { locationLabel: "Meeting URL", locationPlaceholder: "https://zoom.us/j/...", roomLabel: "Meeting ID", roomPlaceholder: "123 456 7890" },
    GOOGLE_MEET: { locationLabel: "Meeting URL", locationPlaceholder: "https://meet.google.com/...", roomLabel: "Meeting Code", roomPlaceholder: "abc-defg-hij" },
    ROLL20: { locationLabel: "Game URL", locationPlaceholder: "https://app.roll20.net/join/...", roomLabel: "Campaign", roomPlaceholder: "Campaign name" },
    FOUNDRY_VTT: { locationLabel: "Server URL", locationPlaceholder: "https://your-foundry.com", roomLabel: "World", roomPlaceholder: "World name" },
    IN_PERSON: { locationLabel: "Address", locationPlaceholder: "123 Main St", roomLabel: "Notes", roomPlaceholder: "Ring doorbell" },
    OTHER: { locationLabel: "Location", locationPlaceholder: "Enter location or URL", roomLabel: "Details", roomPlaceholder: "Additional info" },
  };
  return configs[type];
};

export function CreateCampaignForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameSystem, setGameSystem] = useState<GameSystem | null>(null);
  const [isCreatingGameSystem, setIsCreatingGameSystem] = useState(false);
  const [newGameSystemName, setNewGameSystemName] = useState("");
  const [campaignImageBase64, setCampaignImageBase64] = useState<string | null>(null);
  const [sessionLengthMinutes, setSessionLengthMinutes] = useState(180);
  const [timezone, setTimezone] = useState(getBrowserTimezone());
  const [startDate, setStartDate] = useState<string | null>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string | null>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [earliestTime, setEarliestTime] = useState("17:00");
  const [latestTime, setLatestTime] = useState("23:00");
  const [meetingType, setMeetingType] = useState<MeetingType | null>(null);
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingRoom, setMeetingRoom] = useState("");
  const [preSessionInstructions, setPreSessionInstructions] = useState("");
  const [playerPrepUrls, setPlayerPrepUrls] = useState<PrepUrl[]>([]);
  const [hasInstructions, setHasInstructions] = useState(false);

  // Update pre-session instructions when game system changes
  useEffect(() => {
    if (gameSystem?.defaultInstructions) {
      setPreSessionInstructions(gameSystem.defaultInstructions);
      setHasInstructions(true);
    }
    if (gameSystem?.defaultUrls && gameSystem.defaultUrls.length > 0) {
      setPlayerPrepUrls(gameSystem.defaultUrls);
      setHasInstructions(true);
    }
  }, [gameSystem]);

  const handleCreateGameSystem = async () => {
    if (!newGameSystemName.trim()) return;

    try {
      const res = await fetch("/api/game-systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGameSystemName.trim() }),
      });
      if (res.ok) {
        const system = await res.json();
        setGameSystem(system);
        setIsCreatingGameSystem(false);
        setNewGameSystemName("");
      }
    } catch (err) {
      console.error("Failed to create game system:", err);
    }
  };

  const handleAddUrl = useCallback(() => {
    setPlayerPrepUrls(prev => [...prev, { label: "Rules Reference", url: "" }]);
  }, []);

  const handleRemoveUrl = useCallback((index: number) => {
    setPlayerPrepUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateUrl = useCallback((index: number, field: "label" | "url", value: string) => {
    setPlayerPrepUrls(prev => {
      const newUrls = [...prev];
      newUrls[index] = { ...newUrls[index], [field]: value };
      return newUrls;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!title.trim()) throw new Error("Campaign name is required");
      if (!startDate || !endDate) throw new Error("Date range is required");

      const validUrls = playerPrepUrls.filter(u => u.label.trim() && u.url.trim());

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        timezone,
        gameSystemId: gameSystem?.id || undefined,
        campaignImageBase64: campaignImageBase64 || undefined,
        sessionLengthMinutes,
        customPreSessionInstructions: preSessionInstructions.trim() || undefined,
        playerPrepUrls: validUrls.length > 0 ? validUrls : undefined,
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
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Steps + Main Card */}
        <div className="space-y-6 lg:col-span-2">
          {/* How it works - compact horizontal */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 p-4 dark:from-blue-500/5 dark:via-indigo-500/5 dark:to-purple-500/5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">1</div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Create</span>
              </div>
              <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">2</div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Share</span>
              </div>
              <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white">3</div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Collect</span>
              </div>
              <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">4</div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Play!</span>
              </div>
            </div>
          </div>

          {/* Main Campaign Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Campaign Name
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Curse of Strahd"
                  className="mt-1.5 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Description <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A gothic horror adventure in the mists of Barovia..."
                  rows={2}
                  className="mt-1.5 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Cover Image <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <div className="mt-1.5">
                  <ImageUpload value={campaignImageBase64} onChange={setCampaignImageBase64} label="" />
                </div>
              </div>

              {/* Two column row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <SessionLengthSelector value={sessionLengthMinutes} onChange={setSessionLengthMinutes} />
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Timezone
                  </label>
                  <div className="mt-1.5">
                    <TimezoneSelector value={timezone} onChange={setTimezone} className="w-full" />
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />

              {/* Time Window */}
              <TimeWindowSelector
                earliestTime={earliestTime}
                latestTime={latestTime}
                onEarliestChange={setEarliestTime}
                onLatestChange={setLatestTime}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !startDate || !endDate}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {isSubmitting ? "Creating..." : "Create Campaign"}
          </button>
        </div>

        {/* Right Column - Optional Cards */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Optional Details
          </p>

          {/* Game System Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Game System
            </label>
            {!isCreatingGameSystem ? (
              <div className="mt-2">
                <GameSystemAutocomplete
                  value={gameSystem}
                  onChange={setGameSystem}
                  onCreateNew={() => setIsCreatingGameSystem(true)}
                />
              </div>
            ) : (
              <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    New System Name
                  </label>
                  <input
                    type="text"
                    value={newGameSystemName}
                    onChange={(e) => setNewGameSystemName(e.target.value)}
                    placeholder="e.g., Pathfinder 2e"
                    className="mt-1 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateGameSystem}
                    className="flex-1 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreatingGameSystem(false); setNewGameSystemName(""); }}
                    className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Show selected game system info */}
            {gameSystem && !isCreatingGameSystem && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {gameSystem.name}
              </div>
            )}
          </div>

          {/* Location Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Meeting Location
            </label>
            <select
              value={meetingType || ""}
              onChange={(e) => setMeetingType(e.target.value as MeetingType || null)}
              className="mt-2 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-zinc-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Select platform...</option>
              {MEETING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {meetingType && (
              <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {getMeetingConfig(meetingType).locationLabel}
                  </label>
                  <input
                    type="text"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    placeholder={getMeetingConfig(meetingType).locationPlaceholder}
                    className="mt-1 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {getMeetingConfig(meetingType).roomLabel}
                  </label>
                  <input
                    type="text"
                    value={meetingRoom}
                    onChange={(e) => setMeetingRoom(e.target.value)}
                    placeholder={getMeetingConfig(meetingType).roomPlaceholder}
                    className="mt-1 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Player Prep Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Player Prep
              </label>
              {!hasInstructions && (
                <button
                  type="button"
                  onClick={() => setHasInstructions(true)}
                  className="text-xs font-medium text-blue-500 hover:text-blue-600"
                >
                  + Add
                </button>
              )}
            </div>

            {hasInstructions && (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Instructions
                  </label>
                  <textarea
                    value={preSessionInstructions}
                    onChange={(e) => setPreSessionInstructions(e.target.value)}
                    placeholder="Bring your character sheet, review session notes..."
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Helpful Links
                    </label>
                    <button
                      type="button"
                      onClick={handleAddUrl}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      + Add
                    </button>
                  </div>
                  {playerPrepUrls.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {playerPrepUrls.map((urlItem, index) => (
                        <div key={index} className="flex gap-2">
                          <select
                            value={LINK_TYPE_OPTIONS.find(o => o.label === urlItem.label)?.value || "other"}
                            onChange={(e) => {
                              const option = LINK_TYPE_OPTIONS.find(o => o.value === e.target.value);
                              handleUpdateUrl(index, "label", option?.label || "Other");
                            }}
                            className="w-32 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            {LINK_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <input
                            type="url"
                            value={urlItem.url}
                            onChange={(e) => handleUpdateUrl(index, "url", e.target.value)}
                            placeholder="https://..."
                            className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveUrl(index)}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
