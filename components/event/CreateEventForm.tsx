"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TimezoneSelector } from "@/components/timezone/TimezoneSelector";
import { getBrowserTimezone } from "@/lib/utils/timezone";
import type { CreateEventRequest, Event } from "@/lib/types";

export function CreateEventForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState(getBrowserTimezone());
  const [eventType, setEventType] = useState<"oneshot" | "recurring">("oneshot");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: CreateEventRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        timezone,
        isRecurring: eventType === "recurring",
      };

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create event");
      }

      const event: Event = await response.json();
      router.push(`/${event.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  const handleTimezoneChange = useCallback((tz: string) => {
    setTimezone(tz);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Session Name
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Friday Night D&D"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any notes about the campaign or session..."
          rows={3}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Session Type
        </label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="eventType"
              value="oneshot"
              checked={eventType === "oneshot"}
              onChange={() => setEventType("oneshot")}
              className="h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">
              One-shot / Single Session
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="eventType"
              value="recurring"
              checked={eventType === "recurring"}
              onChange={() => setEventType("recurring")}
              className="h-4 w-4 border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">
              Campaign / Recurring
            </span>
          </label>
        </div>
      </div>

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
          Participants can switch to their own timezone when viewing
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !title.trim()}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create Session"}
      </button>
    </form>
  );
}
