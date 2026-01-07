"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CharacterForm } from "@/components/participant/CharacterForm";
import { Footer } from "@/components/layout/Footer";

interface GameSystem {
  id: string;
  name: string;
  imageBase64: string | null;
}

interface ParticipantSummary {
  id: string;
  displayName: string;
  isGm: boolean;
  characterName: string | null;
  characterClass: string | null;
  characterSheetUrl: string | null;
  characterTokenBase64: string | null;
  notes: string | null;
}

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

interface EventProps {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  campaignImageBase64: string | null;
  customPreSessionInstructions: string | null;
  gameSystem: GameSystem | null;
  participants: ParticipantSummary[];
}

interface CharacterEditPageProps {
  event: EventProps;
  participant: Participant;
}

export function CharacterEditPage({
  event,
  participant,
}: CharacterEditPageProps) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to form on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Other party members (excluding current)
  const otherPartyMembers = event.participants.filter(
    (p) => p.id !== participant.id
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header - matches Availability page style */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href={`/${event.slug}`}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {event.title}
                </p>
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Edit {participant.isGm ? "Profile" : "Character"}
                </h1>
              </div>
            </div>
            <button
              onClick={() => router.push(`/${event.slug}`)}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-3 py-4">
        {/* Campaign Overview Section */}
        {event.description && (
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Campaign Overview
            </h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {event.description}
            </p>
          </div>
        )}

        {/* Helpful Links Section */}
        <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Quick Links
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${event.slug}`}
              className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Campaign Home
            </Link>
            <Link
              href={`/${event.slug}/${encodeURIComponent(participant.displayName.toLowerCase().replace(/\s+/g, "-"))}`}
              className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Your Availability
            </Link>
            {participant.characterSheetUrl && (
              <a
                href={participant.characterSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Character Sheet
              </a>
            )}
          </div>
        </div>

        {/* Party Members Section - Horizontal Scroll */}
        {otherPartyMembers.length > 0 && (
          <div className="mb-4">
            <h2 className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Your Party ({otherPartyMembers.length})
            </h2>
            <div
              className="flex gap-2 overflow-x-auto pb-2"
              style={{ maxHeight: "140px" }}
            >
              {otherPartyMembers.map((p) => {
                const playerSlug = encodeURIComponent(
                  p.displayName.toLowerCase().replace(/\s+/g, "-")
                );
                return (
                  <Link
                    key={p.id}
                    href={`/${event.slug}/${playerSlug}/character`}
                    className="flex shrink-0 items-start gap-2 rounded-lg border border-zinc-200 bg-white p-2 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
                    style={{ width: "180px" }}
                  >
                    {p.characterTokenBase64 ? (
                      <img
                        src={p.characterTokenBase64}
                        alt={p.characterName || p.displayName}
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                        {p.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {p.displayName}
                        </p>
                        {p.isGm && (
                          <span className="shrink-0 rounded bg-purple-100 px-1 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            GM
                          </span>
                        )}
                      </div>
                      {p.characterName ? (
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {p.characterName}
                          {p.characterClass && ` · ${p.characterClass}`}
                        </p>
                      ) : (
                        <p className="truncate text-xs italic text-zinc-400 dark:text-zinc-500">
                          No character yet
                        </p>
                      )}
                      {p.notes && (
                        <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Pre-session Instructions */}
        {event.customPreSessionInstructions && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
            <h2 className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
              Before You Play
            </h2>
            <p className="whitespace-pre-wrap text-sm text-amber-700 dark:text-amber-300/80">
              {event.customPreSessionInstructions}
            </p>
          </div>
        )}

        {/* Character Edit Form */}
        <div
          ref={formRef}
          className="scroll-mt-16 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <div className="flex items-center gap-3">
              {participant.characterTokenBase64 ? (
                <img
                  src={participant.characterTokenBase64}
                  alt={participant.characterName || participant.displayName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                  {participant.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {participant.displayName}
                </h2>
                {participant.characterName && (
                  <p className="text-sm text-zinc-500">
                    {participant.characterName}
                    {participant.characterClass &&
                      ` · ${participant.characterClass}`}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="p-4">
            <CharacterForm participant={participant} eventSlug={event.slug} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
