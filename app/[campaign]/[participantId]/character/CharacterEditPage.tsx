"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CharacterForm } from "@/components/participant/CharacterForm";

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
  customPreSessionInstructions: string | null;
}

interface CharacterEditPageProps {
  event: EventProps;
  participant: Participant;
  allParticipants: Participant[];
}

export function CharacterEditPage({
  event,
  participant,
  allParticipants,
}: CharacterEditPageProps) {
  const router = useRouter();

  // Other party members (excluding current participant)
  const otherParticipants = allParticipants.filter((p) => p.id !== participant.id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-red-700">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Left: Title and description */}
            <div className="flex items-center gap-4">
              {/* Character avatar */}
              {participant.characterTokenBase64 ? (
                <img
                  src={participant.characterTokenBase64}
                  alt={participant.characterName || participant.displayName}
                  className="h-16 w-16 rounded-xl object-cover ring-4 ring-white/20 shadow-xl"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-2xl font-bold text-white ring-4 ring-white/20">
                  {participant.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {participant.isGm ? "Edit Profile" : "Character Details"}
                </h1>
                <p className="text-white/80 text-sm sm:text-base">
                  {participant.displayName}
                  {participant.characterName && ` · ${participant.characterName}`}
                </p>
              </div>
            </div>

            {/* Right: Navigation */}
            <div className="flex items-center gap-2">
              <Link
                href={`/${event.slug}/${participant.isGm ? "gm" : participant.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Availability
              </Link>
              <Link
                href={`/${event.slug}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Campaign
              </Link>
            </div>
          </div>

          {/* Quick tips */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Character Info
              </div>
              <p className="text-white/60 text-xs">Add your character name and class for the party</p>
            </div>
            <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Token Image
              </div>
              <p className="text-white/60 text-xs">Upload your character portrait for the party list</p>
            </div>
            <div className="backdrop-blur-sm bg-white/5 rounded-lg px-4 py-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Character Sheet
              </div>
              <p className="text-white/60 text-xs">Link to D&amp;D Beyond, Roll20, or other sheets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Before You Play - Helpful Links */}
          {event.customPreSessionInstructions && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/50 dark:bg-amber-900/20">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                  <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Before You Play
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-amber-800 dark:text-amber-300">
                    {event.customPreSessionInstructions}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Main form column */}
            <div className="lg:col-span-3">
              {/* Character Form Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="p-5">
                  <CharacterForm participant={participant} eventSlug={event.slug} />
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2">
              <div className="sticky top-20 space-y-4">
                {/* Party members for reference */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Your Party
                  </h3>
                  {otherParticipants.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                        <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        You&apos;re the first one here!
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        Share the campaign link to invite others
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {otherParticipants.map((p) => (
                        <Link
                          key={p.id}
                          href={`/${event.slug}/${p.isGm ? "gm" : p.id}/character`}
                          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          {p.characterTokenBase64 ? (
                            <img
                              src={p.characterTokenBase64}
                              alt={p.characterName || p.displayName}
                              className="h-10 w-10 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                              {p.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {p.displayName}
                              </span>
                              {p.isGm && (
                                <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
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
                              <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
                                No character yet
                              </p>
                            )}
                          </div>
                          <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick links */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Quick Links
                  </h3>
                  <div className="space-y-2">
                    <Link
                      href={`/${event.slug}/${participant.isGm ? "gm" : participant.id}`}
                      className="flex items-center gap-3 rounded-xl p-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Edit Availability
                    </Link>
                    <Link
                      href={`/${event.slug}`}
                      className="flex items-center gap-3 rounded-xl p-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      View Campaign
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
