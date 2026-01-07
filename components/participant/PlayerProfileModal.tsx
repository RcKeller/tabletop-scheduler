"use client";

import { useState, useCallback, useEffect } from "react";
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

interface PlayerProfileModalProps {
  participant: Participant;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Participant>) => Promise<void>;
  eventSlug: string;
  isCurrentUser: boolean;
}

export function PlayerProfileModal({
  participant,
  isOpen,
  onClose,
  onSave,
  eventSlug,
  isCurrentUser,
}: PlayerProfileModalProps) {
  const [characterName, setCharacterName] = useState(participant.characterName || "");
  const [characterClass, setCharacterClass] = useState(participant.characterClass || "");
  const [characterSheetUrl, setCharacterSheetUrl] = useState(participant.characterSheetUrl || "");
  const [characterTokenBase64, setCharacterTokenBase64] = useState<string | null>(participant.characterTokenBase64);
  const [notes, setNotes] = useState(participant.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens with new participant
  useEffect(() => {
    if (isOpen) {
      setCharacterName(participant.characterName || "");
      setCharacterClass(participant.characterClass || "");
      setCharacterSheetUrl(participant.characterSheetUrl || "");
      setCharacterTokenBase64(participant.characterTokenBase64);
      setNotes(participant.notes || "");
    }
  }, [isOpen, participant]);

  // Close on escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave({
        characterName: characterName.trim() || null,
        characterClass: characterClass.trim() || null,
        characterSheetUrl: characterSheetUrl.trim() || null,
        characterTokenBase64,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [characterName, characterClass, characterSheetUrl, characterTokenBase64, notes, onSave, onClose]);

  if (!isOpen) return null;

  const playerSlug = encodeURIComponent(participant.displayName.toLowerCase().replace(/\s+/g, "-"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {characterTokenBase64 || participant.characterTokenBase64 ? (
              <img
                src={characterTokenBase64 || participant.characterTokenBase64 || ""}
                alt={characterName || participant.displayName}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {participant.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {participant.displayName}
              </h2>
              {participant.isGm && (
                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  Game Master
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isCurrentUser ? (
          /* Editable form for current user */
          <div className="space-y-4">
            {!participant.isGm && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Character Name
                    </label>
                    <input
                      type="text"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      placeholder="e.g., Elara Nightwhisper"
                      className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Class
                    </label>
                    <input
                      type="text"
                      value={characterClass}
                      onChange={(e) => setCharacterClass(e.target.value)}
                      placeholder="e.g., Rogue"
                      className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Character Sheet URL
                  </label>
                  <input
                    type="url"
                    value={characterSheetUrl}
                    onChange={(e) => setCharacterSheetUrl(e.target.value)}
                    placeholder="https://dndbeyond.com/..."
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Character Token
                  </label>
                  <div className="mt-1">
                    <ImageUpload
                      value={characterTokenBase64}
                      onChange={setCharacterTokenBase64}
                      label=""
                      maxSizeMB={0.5}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Notes <span className="font-normal text-zinc-400">(visible to party)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 255))}
                placeholder="Share something with your party..."
                rows={2}
                maxLength={255}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-400">{notes.length}/255</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <a
                href={`/${eventSlug}/${playerSlug}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Edit Availability
              </a>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        ) : (
          /* Read-only view for other users */
          <div className="space-y-4">
            {participant.characterName && (
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <div className="flex items-center gap-3">
                  {participant.characterTokenBase64 && (
                    <img
                      src={participant.characterTokenBase64}
                      alt={participant.characterName}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {participant.characterName}
                    </p>
                    {participant.characterClass && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {participant.characterClass}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {participant.notes && (
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Notes</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{participant.notes}</p>
              </div>
            )}

            {participant.characterSheetUrl && (
              <a
                href={participant.characterSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Character Sheet
              </a>
            )}

            {!participant.characterName && !participant.notes && !participant.characterSheetUrl && (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
                No character info added yet
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
