import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { PlayerAvailabilityPage } from "./PlayerAvailabilityPage";

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
    gameSystem: event.gameSystem ? {
      id: event.gameSystem.id,
      name: event.gameSystem.name,
    } : null,
  };

  const serializedParticipant = {
    id: participant.id,
    displayName: participant.displayName,
    isGm: participant.isGm,
  };

  return (
    <PlayerAvailabilityPage
      event={serializedEvent}
      participant={serializedParticipant}
      method={availabilityMethod as "select" | "pattern" | "describe"}
    />
  );
}
