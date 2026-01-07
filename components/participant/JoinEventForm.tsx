"use client";

import { useState } from "react";

interface Participant {
  id: string;
  eventId: string;
  displayName: string;
  isGm: boolean;
}

interface JoinEventFormProps {
  eventSlug: string;
  onJoined: (participant: Participant) => void;
  hasGm?: boolean;
}

export function JoinEventForm({ eventSlug, onJoined, hasGm = false }: JoinEventFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [isGm, setIsGm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/events/${eventSlug}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          isGm,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join");
      }

      const participant: Participant = await response.json();
      onJoined(participant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="displayName"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Your Name
        </label>
        <input
          type="text"
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g., Thorin or John"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          This is how others will see you. Use your character or real name.
        </p>
      </div>

      {!hasGm && (
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isGm}
              onChange={(e) => setIsGm(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I&apos;m the Game Master / Dungeon Master
            </span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !displayName.trim()}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Joining..." : "Join Campaign"}
      </button>
    </form>
  );
}
