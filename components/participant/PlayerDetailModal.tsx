"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

interface PlayerDetailModalProps {
  participant: Participant;
  isOpen: boolean;
  onClose: () => void;
  eventSlug: string;
  isCurrentUser: boolean;
}

export function PlayerDetailModal({
  participant,
  isOpen,
  onClose,
  eventSlug,
  isCurrentUser,
}: PlayerDetailModalProps) {
  const router = useRouter();
  const playerSlug = encodeURIComponent(
    participant.displayName.toLowerCase().replace(/\s+/g, "-")
  );

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

  if (!isOpen) return null;

  const hasCharacterInfo =
    participant.characterName ||
    participant.characterClass ||
    participant.notes ||
    participant.characterSheetUrl ||
    participant.characterTokenBase64;

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
            {participant.characterTokenBase64 ? (
              <img
                src={participant.characterTokenBase64}
                alt={participant.characterName || participant.displayName}
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
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Character Details (Read-only) */}
        <div className="space-y-4">
          {hasCharacterInfo ? (
            <>
              {(participant.characterName || participant.characterClass) && (
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                  <div className="flex items-center gap-4">
                    {participant.characterTokenBase64 && (
                      <img
                        src={participant.characterTokenBase64}
                        alt={participant.characterName || "Character"}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      {participant.characterName && (
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {participant.characterName}
                        </p>
                      )}
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
                  <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Notes
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {participant.notes}
                  </p>
                </div>
              )}

              {participant.characterSheetUrl && (
                <a
                  href={participant.characterSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  View Character Sheet
                </a>
              )}
            </>
          ) : (
            <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No character info added yet
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/${eventSlug}/${playerSlug}`);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Edit Availability
          </button>
          {isCurrentUser && (
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/${eventSlug}/${playerSlug}/character`);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit Character
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
