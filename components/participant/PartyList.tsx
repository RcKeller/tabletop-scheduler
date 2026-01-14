"use client";

import Link from "next/link";

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

interface PartyListProps {
  participants: Participant[];
  currentUserId?: string;
  eventSlug: string;
  // Display modes
  compact?: boolean;
  clickable?: boolean;
  showCharacterDetails?: boolean;
  // Callbacks
  onParticipantClick?: (participant: Participant) => void;
}

export function PartyList({
  participants,
  currentUserId,
  eventSlug,
  compact = false,
  clickable = true,
  showCharacterDetails = true,
  onParticipantClick,
}: PartyListProps) {
  if (participants.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-200 p-6 text-center dark:border-zinc-700">
        <svg
          className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No players yet
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Share the link to invite your party
        </p>
      </div>
    );
  }

  // Compact mode - horizontal scrolling list of avatars
  if (compact) {
    return (
      <div className="flex -space-x-2 overflow-hidden">
        {participants.map((p) => (
          <div
            key={p.id}
            className="relative"
            title={`${p.displayName}${p.characterName ? ` (${p.characterName})` : ""}`}
          >
            {p.characterTokenBase64 ? (
              <img
                src={p.characterTokenBase64}
                alt={p.displayName}
                className="h-10 w-10 rounded-full border-2 border-white object-cover dark:border-zinc-900"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-sm font-medium text-zinc-600 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-400">
                {p.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {p.isGm && (
              <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[8px] font-bold text-white">
                GM
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Full grid mode
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {participants.map((p) => {
        const isCurrentUser = currentUserId === p.id;
        // Use "gm" for GM participants, otherwise use participant ID
        const participantPath = p.isGm ? "gm" : p.id;

        const content = (
          <div className="flex items-start gap-3">
            {p.characterTokenBase64 ? (
              <img
                src={p.characterTokenBase64}
                alt={p.characterName || p.displayName}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {p.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {p.displayName}
                </span>
                {p.isGm && (
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    GM
                  </span>
                )}
                {isCurrentUser && (
                  <span className="text-xs text-zinc-400">(you)</span>
                )}
              </div>
              {showCharacterDetails && p.characterName && (
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {p.characterName}
                  {p.characterClass && (
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {" "}· {p.characterClass}
                    </span>
                  )}
                </p>
              )}
              {showCharacterDetails && p.notes && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                  {p.notes}
                </p>
              )}
            </div>
            {clickable && (
              <svg
                className="h-5 w-5 shrink-0 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </div>
        );

        if (clickable && onParticipantClick) {
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onParticipantClick(p)}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-750"
            >
              {content}
            </button>
          );
        }

        if (clickable) {
          return (
            <Link
              key={p.id}
              href={`/${eventSlug}/${participantPath}`}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-750"
            >
              {content}
            </Link>
          );
        }

        return (
          <div
            key={p.id}
            className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
