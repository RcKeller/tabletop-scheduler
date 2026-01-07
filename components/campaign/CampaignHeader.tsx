"use client";

import Link from "next/link";

interface GameSystem {
  id: string;
  name: string;
  imageBase64: string | null;
}

interface CampaignHeaderProps {
  title: string;
  campaignImageBase64: string | null;
  gameSystem: GameSystem | null;
  slug: string;
  onShare?: () => void;
  shareLabel?: string;
}

export function CampaignHeader({
  title,
  campaignImageBase64,
  gameSystem,
  slug,
  onShare,
  shareLabel = "Share",
}: CampaignHeaderProps) {
  return (
    <div className="relative">
      {campaignImageBase64 ? (
        <div className="aspect-[16/9] max-h-[400px] w-full overflow-hidden">
          <img
            src={campaignImageBase64}
            alt={title}
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-br from-blue-600 to-purple-700" />
      )}

      {/* Action buttons in top right */}
      <div className="absolute right-3 top-3 flex items-center gap-2 md:right-4 md:top-4">
        {onShare && (
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {shareLabel}
          </button>
        )}
        <Link
          href={`/${slug}/settings`}
          className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      </div>

      {/* Campaign Title Overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 md:py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end gap-2">
            {gameSystem?.imageBase64 && !campaignImageBase64 && (
              <img
                src={gameSystem.imageBase64}
                alt={gameSystem.name}
                className="h-16 w-16 rounded-lg border-2 border-white/20 object-cover shadow-lg"
              />
            )}
            <div>
              {gameSystem && (
                <p className="text-sm font-medium text-white/80">
                  {gameSystem.name}
                </p>
              )}
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                {title}
              </h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
