import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { GmAvailabilityPage } from "./GmAvailabilityPage";

interface Props {
  params: Promise<{ campaign: string }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      gameSystem: true,
      participants: {
        where: { isGm: true },
        take: 1,
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Find GM participant
  const gmParticipant = event.participants[0];

  if (!gmParticipant) {
    // No GM found - redirect to campaign page
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
    customPreSessionInstructions: event.customPreSessionInstructions,
    gameSystem: event.gameSystem ? {
      id: event.gameSystem.id,
      name: event.gameSystem.name,
    } : null,
  };

  const serializedParticipant = {
    id: gmParticipant.id,
    displayName: gmParticipant.displayName,
    isGm: gmParticipant.isGm,
  };

  return (
    <GmAvailabilityPage
      event={serializedEvent}
      participant={serializedParticipant}
    />
  );
}
