"use client";

import Link from "next/link";
import { ReactNode } from "react";

type CtaVariant = "success" | "info" | "invite" | "join";

interface FloatingGlassCtaProps {
  children: ReactNode;
  show?: boolean;
}

/**
 * Full-width floating glass CTA banner that snaps to the bottom of the viewport.
 * Used consistently across the app for action prompts.
 */
export function FloatingGlassCta({
  children,
  show = true,
}: FloatingGlassCtaProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50">
      <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-t border-zinc-200/50 dark:border-zinc-700/50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// Variant styling helpers
function getVariantStyles(variant: CtaVariant) {
  switch (variant) {
    case "success":
      return {
        icon: "from-green-500 to-emerald-600",
        iconShadow: "shadow-green-500/25",
        button: "from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25",
      };
    case "info":
      return {
        icon: "from-blue-500 to-indigo-600",
        iconShadow: "shadow-blue-500/25",
        button: "from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25",
      };
    case "invite":
      return {
        icon: "from-purple-500 to-indigo-600",
        iconShadow: "shadow-purple-500/25",
        button: "from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/25",
      };
    case "join":
      return {
        icon: "from-blue-500 to-indigo-600",
        iconShadow: "shadow-blue-500/25",
        button: "from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25",
      };
  }
}

// Icon components
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

// Pre-built CTA variants

interface GmCtaProps {
  campaignSlug: string;
  onCopyLink?: () => void;
  linkCopied?: boolean;
  savedAt?: Date | null;  // Timestamp of last save
}

function formatSaveTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export function GmCompleteCta({ campaignSlug, onCopyLink, linkCopied, savedAt }: GmCtaProps) {
  const styles = getVariantStyles("success");

  return (
    <FloatingGlassCta>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${styles.icon} shadow-lg ${styles.iconShadow}`}>
            <CheckIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-white text-sm">
              {savedAt ? `Availability saved at ${formatSaveTime(savedAt)}` : "Availability saved!"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Share your campaign link with players</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {linkCopied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <ShareIcon className="h-3.5 w-3.5" />
                Copy Link
              </>
            )}
          </button>
          <Link
            href={`/${campaignSlug}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${styles.button} shadow-md transition-all`}
          >
            View Campaign
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </FloatingGlassCta>
  );
}

interface PlayerCtaProps {
  campaignSlug: string;
  participantId: string;
  hasCharacter?: boolean;
  savedAt?: Date | null;  // Timestamp of last save
}

export function PlayerCompleteCta({ campaignSlug, participantId, hasCharacter, savedAt }: PlayerCtaProps) {
  const styles = getVariantStyles("success");

  return (
    <FloatingGlassCta>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${styles.icon} shadow-lg ${styles.iconShadow}`}>
            <CheckIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-white text-sm">
              {savedAt ? `Availability saved at ${formatSaveTime(savedAt)}` : "Availability saved!"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {hasCharacter ? "Your GM can now see when you're free" : "Now set up your character"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${campaignSlug}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            View Campaign
          </Link>
          {!hasCharacter && (
            <Link
              href={`/${campaignSlug}/${participantId}/character`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${styles.button} shadow-md transition-all`}
            >
              Set Up Character
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </FloatingGlassCta>
  );
}

interface JoinCtaProps {
  children: ReactNode;
  message?: string;
}

export function JoinCta({ children, message = "Set your availability and join this campaign" }: JoinCtaProps) {
  const styles = getVariantStyles("join");

  return (
    <FloatingGlassCta>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${styles.icon} shadow-lg ${styles.iconShadow}`}>
            <UserPlusIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-white text-sm">Join the Party!</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {children}
        </div>
      </div>
    </FloatingGlassCta>
  );
}

interface StatusCtaProps {
  campaignSlug: string;
  participantId: string;
  displayName: string;
  isGm: boolean;
}

export function StatusCta({ campaignSlug, participantId, displayName, isGm }: StatusCtaProps) {
  const styles = getVariantStyles("success");

  return (
    <FloatingGlassCta>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${styles.icon} shadow-lg ${styles.iconShadow}`}>
            <CheckIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-white text-sm">
              Joined as {displayName}{isGm && " (GM)"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">You're part of this campaign</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isGm && (
            <Link
              href={`/${campaignSlug}/${participantId}/character`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Edit Character
            </Link>
          )}
          <Link
            href={isGm ? `/${campaignSlug}/gm` : `/${campaignSlug}/${participantId}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${styles.button} shadow-md transition-all`}
          >
            Edit Availability
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </FloatingGlassCta>
  );
}

interface InviteCtaProps {
  campaignSlug: string;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

export function InviteCta({ campaignSlug, onCopyLink, linkCopied }: InviteCtaProps) {
  const styles = getVariantStyles("invite");

  return (
    <FloatingGlassCta>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${styles.icon} shadow-lg ${styles.iconShadow}`}>
            <ShareIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 dark:text-white text-sm">Campaign Ready!</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Invite players to join your campaign</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${campaignSlug}/gm`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Edit Availability
          </Link>
          <button
            onClick={onCopyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${styles.button} shadow-md transition-all`}
          >
            {linkCopied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <ShareIcon className="h-3.5 w-3.5" />
                Share Link
              </>
            )}
          </button>
        </div>
      </div>
    </FloatingGlassCta>
  );
}
