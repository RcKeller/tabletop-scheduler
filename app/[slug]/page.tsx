import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { EventPage } from "./EventPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      gameSystem: true,
    },
  });

  if (!event) {
    notFound();
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
    meetingType: event.meetingType,
    meetingLocation: event.meetingLocation,
    meetingRoom: event.meetingRoom,
    campaignImageBase64: event.campaignImageBase64,
    customPreSessionInstructions: event.customPreSessionInstructions,
    gameSystem: event.gameSystem ? {
      id: event.gameSystem.id,
      name: event.gameSystem.name,
      imageBase64: event.gameSystem.imageBase64,
    } : null,
    createdAt: event.createdAt.toISOString(),
  };

  return <EventPage event={serializedEvent} />;
}
