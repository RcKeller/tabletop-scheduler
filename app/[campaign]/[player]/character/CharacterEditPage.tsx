"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CampaignHeader } from "@/components/campaign/CampaignHeader";
import { CharacterForm } from "@/components/participant/CharacterForm";

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
  characterTokenBase64: string | null;
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
  const formRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to form on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <CampaignHeader
        title={event.title}
        campaignImageBase64={event.campaignImageBase64}
        gameSystem={event.gameSystem}
      />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-3 py-3">
        {/* First Section: Two columns */}
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Left Column: Campaign info */}
          <div className="space-y-3 lg:col-span-2">
            {/* Description */}
            {event.description && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {event.description}
                </p>
              </div>
            )}

            {/* Player Prep / Pre-session Instructions */}
            {event.customPreSessionInstructions && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Before You Play
                </h2>
                <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                  {event.customPreSessionInstructions}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Party */}
          <div className="space-y-3">
            {/* Back to Campaign Link */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <Link
                href={`/${event.slug}`}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Campaign
              </Link>
            </div>

            {/* Party Members (condensed) */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Party ({event.participants.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {event.participants.map((p) => {
                  const isCurrentUser = p.id === participant.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${
                        isCurrentUser
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {p.characterTokenBase64 ? (
                        <img
                          src={p.characterTokenBase64}
                          alt={p.displayName}
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-xs dark:bg-zinc-700">
                          {p.displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span>{p.displayName}</span>
                      {p.isGm && (
                        <span className="rounded bg-purple-200 px-1 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400">
                          GM
                        </span>
                      )}
                      {isCurrentUser && <span>(you)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Character Edit Form Section */}
        <div
          ref={formRef}
          className="mt-4 scroll-mt-4 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
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
                  Edit {participant.isGm ? "Profile" : "Character"}
                </h2>
                <p className="text-sm text-zinc-500">{participant.displayName}</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <CharacterForm participant={participant} eventSlug={event.slug} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-4 border-t border-zinc-200 py-2 text-center text-xs text-zinc-500 dark:border-zinc-800">
        When2Play
      </footer>
    </div>
  );
}
