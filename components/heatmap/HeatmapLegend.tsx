"use client";

interface HeatmapLegendProps {
  totalParticipants: number;
}

export function HeatmapLegend({ totalParticipants }: HeatmapLegendProps) {
  const legendItems = [
    { label: "All available", color: "bg-green-600 dark:bg-green-500", percent: 100 },
    { label: "Most available", color: "bg-green-500 dark:bg-green-600", percent: 75 },
    { label: "Some available", color: "bg-green-400 dark:bg-green-500", percent: 50 },
    { label: "Few available", color: "bg-green-300 dark:bg-green-400", percent: 25 },
    { label: "Very few", color: "bg-green-200 dark:bg-green-300", percent: 1 },
    { label: "None available", color: "bg-zinc-200 dark:bg-zinc-700", percent: 0 },
  ];

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Availability ({totalParticipants} {totalParticipants === 1 ? "player" : "players"})
      </div>
      <div className="flex flex-col gap-1">
        {legendItems.map((item) => (
          <div key={item.percent} className="flex items-center gap-2 text-xs">
            <div className={`h-3 w-6 rounded ${item.color}`} />
            <span className="text-zinc-600 dark:text-zinc-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
