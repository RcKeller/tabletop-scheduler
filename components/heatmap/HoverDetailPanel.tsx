"use client";

import { format, parse } from "date-fns";

interface Participant {
  id: string;
  name: string;
}

interface HoverDetailPanelProps {
  date: string | null;
  time: string | null;
  availableParticipants: Participant[];
  unavailableParticipants: Participant[];
  totalParticipants: number;
}

export function HoverDetailPanel({
  date,
  time,
  availableParticipants,
  unavailableParticipants,
  totalParticipants,
}: HoverDetailPanelProps) {
  if (!date || !time) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
        Hover over a time slot to see availability details
      </div>
    );
  }

  const dateObj = new Date(date);
  const formattedDate = format(dateObj, "EEEE, MMMM d");
  const formattedTime = format(parse(time, "HH:mm", new Date()), "h:mm a");
  const availableCount = availableParticipants.length;
  const percentage = totalParticipants > 0
    ? Math.round((availableCount / totalParticipants) * 100)
    : 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div>
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {formattedDate}
        </div>
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {formattedTime}
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {availableCount} of {totalParticipants} available ({percentage}%)
        </div>
      </div>

      {/* Available */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-green-600 dark:text-green-400">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Available ({availableParticipants.length})
        </div>
        {availableParticipants.length > 0 ? (
          <ul className="space-y-1">
            {availableParticipants.map((p) => (
              <li key={p.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                {p.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
            No one available
          </p>
        )}
      </div>

      {/* Unavailable */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          Unavailable ({unavailableParticipants.length})
        </div>
        {unavailableParticipants.length > 0 ? (
          <ul className="space-y-1">
            {unavailableParticipants.map((p) => (
              <li key={p.id} className="text-sm text-zinc-500 dark:text-zinc-400">
                {p.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
            Everyone is available!
          </p>
        )}
      </div>
    </div>
  );
}
