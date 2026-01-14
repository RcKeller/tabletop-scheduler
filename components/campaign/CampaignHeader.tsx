"use client";

import type { ReactNode } from "react";

interface GameSystem {
  id: string;
  name: string;
  imageBase64: string | null;
}

interface CampaignHeaderProps {
  title: string;
  campaignImageBase64: string | null;
  gameSystem: GameSystem | null;
  description?: string | null;
  children?: ReactNode;
}

export function CampaignHeader({
  title,
  campaignImageBase64,
  gameSystem,
  description,
  children,
}: CampaignHeaderProps) {
  // Use campaign image first, then game system image, then gradient
  const coverImage = campaignImageBase64 || gameSystem?.imageBase64 || null;

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      {coverImage ? (
        <>
          {/* Cover image with blur effect */}
          <div className="absolute inset-0">
            <img
              src={coverImage}
              alt=""
              className="h-full w-full object-cover object-center scale-110 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />
          </div>
          <div className="relative min-h-[220px] sm:min-h-[260px]" />
        </>
      ) : (
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
          {/* Dot pattern overlay for non-image headers */}
          <div className="absolute inset-0 opacity-10">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hero-pattern-campaign" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-pattern-campaign)" />
            </svg>
          </div>
          <div className="relative min-h-[220px] sm:min-h-[260px]" />
        </div>
      )}

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-end px-4 pb-5 pt-8 md:pb-6">
        <div className="mx-auto w-full max-w-5xl">
          {/* Title section with icon */}
          <div className="flex items-end gap-4 mb-4">
            {/* Game system icon - show if different from cover or no cover */}
            {gameSystem?.imageBase64 && (
              <div className="shrink-0">
                <img
                  src={gameSystem.imageBase64}
                  alt={gameSystem.name}
                  className="h-16 w-16 rounded-xl border-2 border-white/30 object-cover shadow-xl sm:h-20 sm:w-20"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {gameSystem && (
                <p className="text-sm font-medium text-white/80 mb-1">
                  {gameSystem.name}
                </p>
              )}
              <h1 className="text-2xl font-bold text-white md:text-3xl lg:text-4xl line-clamp-2">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-white/80 line-clamp-2 max-w-2xl">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Info cards slot - glass effect cards */}
          {children && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Glass info card component for use in hero
interface HeroInfoCardProps {
  icon: ReactNode;
  label: string;
  value: string;
}

export function HeroInfoCard({ icon, label, value }: HeroInfoCardProps) {
  return (
    <div className="backdrop-blur-md bg-white/10 rounded-lg px-3 py-2 border border-white/20">
      <div className="flex items-center gap-2 text-white/70 text-xs mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-white text-sm font-medium truncate">{value}</p>
    </div>
  );
}
