"use client";

import Link from "next/link";
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
  const hasImage = !!campaignImageBase64;

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      {hasImage ? (
        <div className="aspect-[21/9] max-h-[320px] w-full overflow-hidden">
          <img
            src={campaignImageBase64}
            alt={title}
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>
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
          <div className="relative min-h-[180px] sm:min-h-[200px]" />
        </div>
      )}

      {/* Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8 md:pb-6">
        <div className="mx-auto max-w-5xl">
          {/* Title section */}
          <div className="flex items-end gap-3 mb-4">
            {gameSystem?.imageBase64 && (
              <img
                src={gameSystem.imageBase64}
                alt={gameSystem.name}
                className="h-14 w-14 rounded-xl border-2 border-white/20 object-cover shadow-lg sm:h-16 sm:w-16"
              />
            )}
            <div className="min-w-0 flex-1">
              {gameSystem && (
                <p className="text-sm font-medium text-white/70 mb-0.5">
                  {gameSystem.name}
                </p>
              )}
              <h1 className="text-2xl font-bold text-white md:text-3xl truncate">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-white/70 line-clamp-2 max-w-2xl">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Info cards slot */}
          {children && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
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
