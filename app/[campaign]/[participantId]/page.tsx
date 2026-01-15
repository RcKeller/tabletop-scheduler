import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { format } from "date-fns";
import { ParticipantPageClient } from "./ParticipantPageClient";
import { computeEffectiveRanges, minutesToTime, type AvailabilityRule, type DateRange } from "@/lib/availability";

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

  // Fetch event with participants and their availability rules
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
        include: {
          availabilityRules: true,
        },
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
    latestTime: event.latestTime || "24:00",
  };

  const participantData = {
    id: participant.id,
    displayName: participant.displayName,
    isGm: participant.isGm,
    timezone: participant.timezone,
  };

  // Compute GM availability for players to see as blue stripes
  let gmAvailability: { date: string; startTime: string; endTime: string }[] = [];
  if (!participant.isGm) {
    const gmParticipant = event.participants.find((p) => p.isGm);
    if (gmParticipant && gmParticipant.availabilityRules.length > 0) {
      // Convert Prisma rules to AvailabilityRule type
      const gmRules: AvailabilityRule[] = gmParticipant.availabilityRules.map((r) => ({
        id: r.id,
        participantId: r.participantId,
        ruleType: r.ruleType as AvailabilityRule["ruleType"],
        dayOfWeek: r.dayOfWeek,
        specificDate: r.specificDate ? format(r.specificDate, "yyyy-MM-dd") : null,
        startTime: r.startTime,
        endTime: r.endTime,
        crossesMidnight: r.crossesMidnight ?? undefined,
        originalTimezone: r.originalTimezone,
        originalDayOfWeek: r.originalDayOfWeek,
        reason: r.reason,
        source: r.source as AvailabilityRule["source"],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      // Compute effective availability for the event date range
      const dateRange: DateRange = {
        startDate: eventData.startDate,
        endDate: eventData.endDate,
      };
      const effectiveRanges = computeEffectiveRanges(gmRules, dateRange);

      // Convert ranges to slots
      // Handle overnight ranges (endMinutes >= 1440) by splitting them
      for (const [date, dayAvail] of effectiveRanges) {
        for (const range of dayAvail.availableRanges) {
          if (range.endMinutes > 1440) {
            // Overnight range - split into two parts
            // Part 1: startTime to midnight (24:00)
            gmAvailability.push({
              date,
              startTime: minutesToTime(range.startMinutes),
              endTime: "24:00",
            });
            // Part 2: midnight to endTime on next day
            const nextDate = new Date(date + "T12:00:00Z");
            nextDate.setUTCDate(nextDate.getUTCDate() + 1);
            const nextDateStr = nextDate.toISOString().split("T")[0];
            const wrappedEnd = range.endMinutes - 1440;
            if (wrappedEnd > 0) {
              gmAvailability.push({
                date: nextDateStr,
                startTime: "00:00",
                endTime: minutesToTime(wrappedEnd),
              });
            }
          } else if (range.endMinutes === 1440) {
            // Full day ending at midnight
            gmAvailability.push({
              date,
              startTime: minutesToTime(range.startMinutes),
              endTime: "24:00",
            });
          } else {
            gmAvailability.push({
              date,
              startTime: minutesToTime(range.startMinutes),
              endTime: minutesToTime(range.endMinutes),
            });
          }
        }
      }
    }
  }

  return (
    <ParticipantPageClient
      event={eventData}
      participant={participantData}
      campaignSlug={slug}
      gmAvailability={gmAvailability}
    />
  );
}
