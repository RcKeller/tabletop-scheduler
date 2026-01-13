"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTimezone } from "./TimezoneProvider";
import { TimezoneAutocomplete } from "@/components/timezone/TimezoneAutocomplete";

interface NavbarProps {
  campaignSlug?: string;
  campaignTitle?: string;
}

export function Navbar({ campaignSlug, campaignTitle }: NavbarProps) {
  const pathname = usePathname();
  const { timezone, setTimezone, isLoaded } = useTimezone();

  // Determine which nav items to show based on context
  const isInCampaign = !!campaignSlug;

  // Check if current path matches a link
  const isActive = (path: string) => {
    if (path === `/${campaignSlug}`) {
      return pathname === path;
    }
    return pathname?.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Left: Logo / Campaign name */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100"
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
                  className="truncate font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
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
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === `/${campaignSlug}`
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                Overview
              </Link>
              <Link
                href={`/${campaignSlug}/gm`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === `/${campaignSlug}/gm`
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                GM Schedule
              </Link>
              <Link
                href={`/${campaignSlug}/settings`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === `/${campaignSlug}/settings`
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                Settings
              </Link>
            </div>
          )}

          {/* Right: Timezone selector */}
          <div className="flex items-center gap-3">
            {isLoaded && (
              <div className="w-44">
                <TimezoneAutocomplete
                  value={timezone}
                  onChange={setTimezone}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
