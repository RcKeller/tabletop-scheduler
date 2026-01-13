import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { format } from "date-fns";
import { ParticipantPageClient } from "./ParticipantPageClient";

interface PageProps {
  params: Promise<{ campaign: string; participantId: string }>;
}

// Reserved route segments that aren't participant IDs
const RESERVED_SEGMENTS = ["settings", "system"];

export default async function ParticipantPage({ params }: PageProps) {
  const { campaign: slug, participantId } = await params;

  // Skip if this is a reserved segment (handled by other routes)
  if (RESERVED_SEGMENTS.includes(participantId)) {
    notFound();
  }

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

  let participant = null;

  // Handle "gm" as special case - find or create GM participant
  if (participantId === "gm") {
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
  } else {
    // Try to find by UUID
    participant = event.participants.find((p) => p.id === participantId);

    // Also support legacy URL-safe display name format for backwards compatibility
    if (!participant) {
      participant = event.participants.find((p) => {
        const nameSlug = p.displayName.toLowerCase().replace(/\s+/g, "-");
        return nameSlug === decodeURIComponent(participantId);
      });
    }
  }

  if (!participant) {
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
    <ParticipantPageClient
      event={eventData}
      participant={participantData}
      campaignSlug={slug}
    />
  );
}
