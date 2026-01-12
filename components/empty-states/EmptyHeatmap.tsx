"use client";

interface EmptyHeatmapProps {
  hasPlayers: boolean;
  className?: string;
}

export function EmptyHeatmap({ hasPlayers, className = "" }: EmptyHeatmapProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <svg
          className="h-8 w-8 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {hasPlayers ? "Waiting for availability" : "No availability data yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        {hasPlayers
          ? "Players have joined but haven't submitted their availability yet. The heatmap will appear once players indicate when they're free."
          : "Invite players to your campaign and have them submit their availability to see the best times to play."}
      </p>

      {/* Placeholder grid */}
      <div className="mx-auto mt-6 grid max-w-sm grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded bg-zinc-100 dark:bg-zinc-800"
            style={{
              opacity: 0.3 + ((i * 7 + 3) % 10) * 0.03,
            }}
          />
        ))}
      </div>
    </div>
  );
}
