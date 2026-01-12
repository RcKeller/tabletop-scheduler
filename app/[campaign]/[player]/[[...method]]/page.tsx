import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { PlayerAvailabilityPage } from "./PlayerAvailabilityPage";
import { getGmAvailabilityBounds } from "@/lib/utils/gm-availability";
import { utcToLocal } from "@/lib/utils/timezone";
import type { GeneralAvailability, TimeSlot } from "@/lib/types";

interface Props {
  params: Promise<{ campaign: string; player: string; method?: string[] }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug, player: playerSlug, method } = await params;

  // Determine the method (default to "select")
  const availabilityMethod = method?.[0] || "select";

  // Validate method
  if (!["select", "pattern", "describe"].includes(availabilityMethod)) {
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      gameSystem: true,
      participants: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Find participant by URL-safe display name
  const participant = event.participants.find((p) => {
    const participantSlug = p.displayName.toLowerCase().replace(/\s+/g, "-");
    return participantSlug === decodeURIComponent(playerSlug);
  });

  if (!participant) {
    // Redirect to campaign page if participant not found
    redirect(`/${slug}`);
  }

  // Calculate GM availability bounds for callouts (skip if this is the GM themselves)
  let gmAvailabilityBounds: { earliest: string | null; latest: string | null; gmTimezone: string | null } = {
    earliest: null,
    latest: null,
    gmTimezone: null,
  };

  if (!participant.isGm) {
    // Find GM participant and their availability
    const gmParticipant = await prisma.participant.findFirst({
      where: { eventId: event.id, isGm: true },
      include: {
        availability: true,
        generalAvailability: true,
      },
    });

    if (gmParticipant) {
      const gmTz = gmParticipant.timezone || "UTC";

      // Patterns are stored in GM's local timezone - use as-is
      const patterns = gmParticipant.generalAvailability.map((ga) => ({
        id: ga.id,
        participantId: ga.participantId,
        dayOfWeek: ga.dayOfWeek,
        startTime: ga.startTime,
        endTime: ga.endTime,
        isAvailable: ga.isAvailable,
      })) as GeneralAvailability[];

      // Slots are stored in UTC - convert to GM's local timezone for consistency
      const slots = gmParticipant.availability.map((a) => {
        const dateStr = a.date.toISOString().split("T")[0];
        const startLocal = utcToLocal(a.startTime, dateStr, gmTz);
        const endLocal = utcToLocal(a.endTime, dateStr, gmTz);
        return {
          date: startLocal.date,
          startTime: startLocal.time,
          endTime: endLocal.time,
        };
      }) as TimeSlot[];

      // Both patterns and slots are now in GM's local timezone
      const bounds = getGmAvailabilityBounds(patterns, slots);
      gmAvailabilityBounds = {
        ...bounds,
        gmTimezone: gmTz,
      };
    }
  }

  // Serialize for client component
  const serializedEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    timezone: event.timezone,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    earliestTime: event.earliestTime,
    latestTime: event.latestTime,
    sessionLengthMinutes: event.sessionLengthMinutes,
    customPreSessionInstructions: event.customPreSessionInstructions,
    gameSystem: event.gameSystem ? {
      id: event.gameSystem.id,
      name: event.gameSystem.name,
    } : null,
  };

  const serializedParticipant = {
    id: participant.id,
    displayName: participant.displayName,
    isGm: participant.isGm,
    hasCharacterInfo: !!(participant.characterName || participant.characterClass),
  };

  return (
    <PlayerAvailabilityPage
      event={serializedEvent}
      participant={serializedParticipant}
      method={availabilityMethod as "select" | "pattern" | "describe"}
      gmAvailabilityBounds={gmAvailabilityBounds}
    />
  );
}
