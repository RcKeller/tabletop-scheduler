"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, addWeeks } from "date-fns";
import { ImageUpload } from "./ImageUpload";
import { getBrowserTimezone } from "@/lib/utils/timezone";
import type { CampaignType } from "@/lib/types";

export function QuickStartForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Essential form state only
  const [title, setTitle] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("CAMPAIGN");
  const [description, setDescription] = useState("");
  const [campaignImageBase64, setCampaignImageBase64] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a campaign title");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Set smart defaults - 6 weeks out for scheduling
      const today = new Date();
      const defaultEndDate = format(addWeeks(today, 6), "yyyy-MM-dd");

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          campaignType,
          campaignImageBase64,
          timezone: getBrowserTimezone(),
          startDate: format(today, "yyyy-MM-dd"),
          endDate: defaultEndDate,
          earliestTime: "17:00",
          latestTime: "23:00",
          sessionLengthMinutes: campaignType === "ONESHOT" ? 240 : 180,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create campaign");
      }

      const data = await res.json();
      // Store GM participant ID for this campaign
      localStorage.setItem(`participant_${data.event.id}`, data.gmParticipant.id);
      // Redirect to settings page to configure optional details
      router.push(`/${data.event.slug}/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* Hero */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Schedule Your Game
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Find the perfect time for your tabletop group to play
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Campaign Type - Big Toggle */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            What are you scheduling?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCampaignType("CAMPAIGN")}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                campaignType === "CAMPAIGN"
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className={`h-5 w-5 ${campaignType === "CAMPAIGN" ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className={`font-semibold ${campaignType === "CAMPAIGN" ? "text-blue-900 dark:text-blue-100" : "text-zinc-700 dark:text-zinc-300"}`}>
                  Campaign
                </span>
              </div>
              <p className={`mt-1 text-xs ${campaignType === "CAMPAIGN" ? "text-blue-700 dark:text-blue-300" : "text-zinc-500 dark:text-zinc-400"}`}>
                Ongoing weekly/bi-weekly
              </p>
            </button>
            <button
              type="button"
              onClick={() => setCampaignType("ONESHOT")}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                campaignType === "ONESHOT"
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className={`h-5 w-5 ${campaignType === "ONESHOT" ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className={`font-semibold ${campaignType === "ONESHOT" ? "text-blue-900 dark:text-blue-100" : "text-zinc-700 dark:text-zinc-300"}`}>
                  One-Shot
                </span>
              </div>
              <p className={`mt-1 text-xs ${campaignType === "ONESHOT" ? "text-blue-700 dark:text-blue-300" : "text-zinc-500 dark:text-zinc-400"}`}>
                Single session game
              </p>
            </button>
          </div>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {campaignType === "ONESHOT" ? "Game Title" : "Campaign Name"} *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={campaignType === "ONESHOT" ? "e.g., Goblin Heist" : "e.g., Curse of Strahd"}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description <span className="text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's your game about? Any details for players..."
            rows={3}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        {/* Campaign Image */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cover Image <span className="text-zinc-400">(optional)</span>
          </label>
          <ImageUpload
            value={campaignImageBase64}
            onChange={setCampaignImageBase64}
            maxSizeMB={2}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </span>
          ) : (
            "Create & Start Scheduling"
          )}
        </button>

        {/* Helper text */}
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          You can add game system, meeting details, and more after creating
        </p>
      </form>
    </div>
  );
}
