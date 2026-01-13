import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { format } from "date-fns";
import { AvailabilityPageClient } from "./AvailabilityPageClient";

interface PageProps {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ role?: string; id?: string }>;
}

export default async function AvailabilityPage({
  params,
  searchParams,
}: PageProps) {
  const { campaign: slug } = await params;
  const { role, id: participantId } = await searchParams;

  // Fetch event with participants
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Determine the mode and participant
  const isGmMode = role === "gm";
  let participant = null;

  if (isGmMode) {
    // Find GM participant
    participant = event.participants.find((p) => p.isGm);
    if (!participant) {
      // Create GM participant if doesn't exist
      participant = await prisma.participant.create({
        data: {
          eventId: event.id,
          displayName: "Game Master",
          isGm: true,
          timezone: event.timezone,
        },
      });
    }
  } else if (participantId) {
    // Find specific participant
    participant = event.participants.find((p) => p.id === participantId);
  }

  if (!participant) {
    // Redirect to campaign page if no valid participant
    notFound();
  }

  // Serialize event data for client
  const eventData = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    timezone: event.timezone,
    startDate: event.startDate
      ? format(event.startDate, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    endDate: event.endDate
      ? format(event.endDate, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    earliestTime: event.earliestTime || "00:00",
    latestTime: event.latestTime || "23:30",
  };

  const participantData = {
    id: participant.id,
    displayName: participant.displayName,
    isGm: participant.isGm,
    timezone: participant.timezone,
  };

  return (
    <AvailabilityPageClient
      event={eventData}
      participant={participantData}
      campaignSlug={slug}
    />
  );
}
