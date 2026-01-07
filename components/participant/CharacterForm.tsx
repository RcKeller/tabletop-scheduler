"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/campaign/ImageUpload";

interface Participant {
  id: string;
  displayName: string;
  isGm: boolean;
  characterName: string | null;
  characterClass: string | null;
  characterSheetUrl: string | null;
  characterTokenBase64: string | null;
  notes: string | null;
}

interface CharacterFormProps {
  participant: Participant;
  eventSlug: string;
}

export function CharacterForm({ participant, eventSlug }: CharacterFormProps) {
  const router = useRouter();
  const [characterName, setCharacterName] = useState(
    participant.characterName || ""
  );
  const [characterClass, setCharacterClass] = useState(
    participant.characterClass || ""
  );
  const [characterSheetUrl, setCharacterSheetUrl] = useState(
    participant.characterSheetUrl || ""
  );
  const [characterTokenBase64, setCharacterTokenBase64] = useState<
    string | null
  >(participant.characterTokenBase64);
  const [notes, setNotes] = useState(participant.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      setError(null);

      try {
        const res = await fetch(`/api/participants/${participant.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterName: characterName.trim() || null,
            characterClass: characterClass.trim() || null,
            characterSheetUrl: characterSheetUrl.trim() || null,
            characterTokenBase64,
            notes: notes.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.details
              ? `${data.error}: ${data.details}`
              : data.error || "Failed to save"
          );
        }

        // Navigate back to campaign page
        router.push(`/${eventSlug}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setIsSaving(false);
      }
    },
    [
      participant.id,
      characterName,
      characterClass,
      characterSheetUrl,
      characterTokenBase64,
      notes,
      eventSlug,
      router,
    ]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${eventSlug}`);
  }, [eventSlug, router]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="characterName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {participant.isGm ? "Display Name" : "Character Name"}
          </label>
          <input
            type="text"
            id="characterName"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder={
              participant.isGm ? "e.g., The DM" : "e.g., Elara Nightwhisper"
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="characterClass"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {participant.isGm ? "Title" : "Class"}
          </label>
          <input
            type="text"
            id="characterClass"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
            placeholder={
              participant.isGm ? "e.g., Dungeon Master" : "e.g., Rogue"
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="characterSheetUrl"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {participant.isGm ? "Reference URL" : "Character Sheet URL"}
        </label>
        <input
          type="url"
          id="characterSheetUrl"
          value={characterSheetUrl}
          onChange={(e) => setCharacterSheetUrl(e.target.value)}
          placeholder={
            participant.isGm ? "https://..." : "https://dndbeyond.com/..."
          }
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {participant.isGm ? "Avatar" : "Character Token"}
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Upload an image to represent{" "}
          {participant.isGm ? "yourself" : "your character"}
        </p>
        <div className="mt-2">
          <ImageUpload
            value={characterTokenBase64}
            onChange={setCharacterTokenBase64}
            label=""
            maxSizeMB={0.5}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Notes{" "}
          <span className="font-normal text-zinc-400">(visible to party)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 255))}
          placeholder="Share something with your party..."
          rows={3}
          maxLength={255}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-400">{notes.length}/255</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Character"}
        </button>
      </div>
    </form>
  );
}
