"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface FloatingGlassCtaProps {
  children: ReactNode;
  show?: boolean;
  position?: "bottom" | "bottom-right";
}

export function FloatingGlassCta({
  children,
  show = true,
  position = "bottom",
}: FloatingGlassCtaProps) {
  if (!show) return null;

  const positionClasses = position === "bottom"
    ? "fixed bottom-0 inset-x-0"
    : "fixed bottom-6 right-6";

  return (
    <div className={`${positionClasses} z-40`}>
      <div className={position === "bottom" ? "mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8" : ""}>
        <div className="backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 rounded-2xl border border-white/20 dark:border-zinc-700/50 shadow-2xl shadow-black/10 dark:shadow-black/30">
          {children}
        </div>
      </div>
    </div>
  );
}

// Pre-built CTA variants for common use cases

interface GmCtaProps {
  campaignSlug: string;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

export function GmCompleteCta({ campaignSlug, onCopyLink, linkCopied }: GmCtaProps) {
  return (
    <FloatingGlassCta>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white">Availability saved!</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">Share your campaign link with players</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <button
              onClick={onCopyLink}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              {linkCopied ? (
                <>
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
            <Link
              href={`/${campaignSlug}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 transition-all"
            >
              View Campaign
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </FloatingGlassCta>
  );
}

interface PlayerCtaProps {
  campaignSlug: string;
  participantId: string;
  hasCharacter?: boolean;
}

export function PlayerCompleteCta({ campaignSlug, participantId, hasCharacter }: PlayerCtaProps) {
  return (
    <FloatingGlassCta>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white">Availability saved!</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                {hasCharacter ? "Your GM can now see when you're free" : "Now set up your character"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Link
              href={`/${campaignSlug}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              View Campaign
            </Link>
            {!hasCharacter && (
              <Link
                href={`/${campaignSlug}/${participantId}/character`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all"
              >
                Set Up Character
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </FloatingGlassCta>
  );
}

interface JoinCtaProps {
  onJoin: () => void;
  message?: string;
}

export function JoinCta({ onJoin, message = "Join this campaign to set your availability" }: JoinCtaProps) {
  return (
    <FloatingGlassCta>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white">Join the Party!</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{message}</p>
            </div>
          </div>
          <button
            onClick={onJoin}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all sm:shrink-0"
          >
            Join Campaign
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </FloatingGlassCta>
  );
}
