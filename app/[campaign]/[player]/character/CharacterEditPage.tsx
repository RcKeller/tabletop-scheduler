"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CharacterForm } from "@/components/participant/CharacterForm";
import { PartyList } from "@/components/participant/PartyList";
import { Footer } from "@/components/layout/Footer";

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
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/${event.slug}`}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {event.title}
                </p>
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {participant.isGm ? "Edit Profile" : "Edit Character"}
                </h1>
              </div>
            </div>
            <button
              onClick={() => router.push(`/${event.slug}`)}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Main form column */}
          <div className="lg:col-span-3">
            {/* Character Form Card */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {/* Profile Header */}
              <div className="flex items-center gap-4 border-b border-zinc-200 p-4 dark:border-zinc-700">
                {participant.characterTokenBase64 ? (
                  <img
                    src={participant.characterTokenBase64}
                    alt={participant.characterName || participant.displayName}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-xl font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    {participant.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {participant.displayName}
                  </h2>
                  {participant.characterName ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {participant.characterName}
                      {participant.characterClass && ` · ${participant.characterClass}`}
                    </p>
                  ) : (
                    <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                      No character details yet
                    </p>
                  )}
                </div>
              </div>

              {/* Form */}
              <div className="p-4">
                <CharacterForm participant={participant} eventSlug={event.slug} />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">
              {/* Pre-session Instructions */}
              {event.customPreSessionInstructions && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        Before You Play
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-blue-700 dark:text-blue-300/80">
                        {event.customPreSessionInstructions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Party members for reference */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Your Party
                </h3>
              {otherParticipants.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  You&apos;re the first one here! Share the campaign link to invite others.
                </p>
              ) : (
                <div className="space-y-3">
                  {otherParticipants.map((p) => (
                    <Link
                      key={p.id}
                      href={`/${event.slug}/${encodeURIComponent(p.displayName.toLowerCase().replace(/\s+/g, "-"))}/character`}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      {p.characterTokenBase64 ? (
                        <img
                          src={p.characterTokenBase64}
                          alt={p.characterName || p.displayName}
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                          {p.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {p.displayName}
                          </span>
                          {p.isGm && (
                            <span className="rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
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
                    </Link>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
