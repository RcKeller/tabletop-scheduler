"use client";

interface Participant {
  id: string;
  displayName: string;
  isGm: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
  currentParticipantId?: string;
}

export function ParticipantList({
  participants,
  currentParticipantId,
}: ParticipantListProps) {
  if (participants.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No one has joined yet. Be the first!
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {participants.map((participant) => (
        <li
          key={participant.id}
          className={`flex items-center justify-between rounded-md px-3 py-2 ${
            participant.id === currentParticipantId
              ? "bg-blue-50 dark:bg-blue-900/20"
              : "bg-zinc-50 dark:bg-zinc-800/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                participant.isGm
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
              }`}
            >
              {participant.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {participant.displayName}
              {participant.id === currentParticipantId && (
                <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                  (you)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {participant.isGm && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                GM
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
