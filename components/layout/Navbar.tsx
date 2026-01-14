"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTimezone } from "./TimezoneProvider";
import { TimezoneAutocomplete } from "@/components/timezone/TimezoneAutocomplete";

interface NavbarProps {
  campaignSlug?: string;
  campaignTitle?: string;
  currentParticipantId?: string;
  isGm?: boolean;
  hasJoined?: boolean;
}

export function Navbar({
  campaignSlug,
  campaignTitle,
  currentParticipantId,
  isGm,
  hasJoined = false,
}: NavbarProps) {
  const pathname = usePathname();
  const { timezone, setTimezone, isLoaded } = useTimezone();

  // Determine which nav items to show based on context
  const isInCampaign = !!campaignSlug;

  // Active state helper
  const isActive = (path: string) => {
    if (path === `/${campaignSlug}`) {
      return pathname === path;
    }
    return pathname?.startsWith(path);
  };

  // Get the availability link based on participant context
  const getAvailabilityLink = () => {
    if (isGm) return `/${campaignSlug}/gm`;
    if (currentParticipantId) return `/${campaignSlug}/${currentParticipantId}`;
    return `/${campaignSlug}/gm`; // Default to GM availability for viewing
  };

  // Check if currently on availability page
  const isOnAvailabilityPage = () => {
    if (!campaignSlug) return false;
    return pathname === `/${campaignSlug}/gm` ||
           (pathname?.startsWith(`/${campaignSlug}/`) &&
            !pathname?.includes("/settings") &&
            !pathname?.includes("/character") &&
            pathname !== `/${campaignSlug}`);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Left: Logo / Campaign name breadcrumb */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 shrink-0"
            >
              <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="hidden sm:inline">When2Play</span>
            </Link>

            {isInCampaign && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">/</span>
                <Link
                  href={`/${campaignSlug}`}
                  className="truncate max-w-[150px] font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  title={campaignTitle || campaignSlug}
                >
                  {campaignTitle || campaignSlug}
                </Link>
              </>
            )}
          </div>

          {/* Center: Navigation links (for campaign context) */}
          {isInCampaign && (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href={`/${campaignSlug}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === `/${campaignSlug}`
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                Campaign
              </Link>
              <Link
                href={getAvailabilityLink()}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isOnAvailabilityPage()
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                Availability
              </Link>
              {hasJoined && !isGm && currentParticipantId && (
                <Link
                  href={`/${campaignSlug}/${currentParticipantId}/character`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname?.includes("/character")
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  }`}
                >
                  Character
                </Link>
              )}
              {isGm && (
                <Link
                  href={`/${campaignSlug}/settings`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname === `/${campaignSlug}/settings`
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  }`}
                >
                  Settings
                </Link>
              )}
            </div>
          )}

          {/* Right: Timezone selector with label */}
          <div className="flex items-center gap-3">
            {isLoaded && (
              <div className="flex items-center gap-2">
                <span className="hidden lg:block text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  Your timezone:
                </span>
                <div className="w-48 lg:w-56">
                  <TimezoneAutocomplete
                    value={timezone}
                    onChange={setTimezone}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
