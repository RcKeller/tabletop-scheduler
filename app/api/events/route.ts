import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSlug } from "@/lib/utils/slug";
import { MeetingType, CampaignType } from "@/lib/generated/prisma";
import { badRequest, created, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title?.trim()) {
      return badRequest("Campaign name is required");
    }

    // Validate session length
    const sessionLengthMinutes = body.sessionLengthMinutes || 180;
    if (sessionLengthMinutes < 60 || sessionLengthMinutes > 480) {
      return badRequest("Session length must be between 1 and 8 hours");
    }

    // Validate date range if provided
    if (body.startDate && body.endDate) {
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return badRequest("Invalid date format");
      }

      if (end < start) {
        return badRequest("End date must be after start date");
      }

      // Check max 3 months
      const maxEnd = new Date(start);
      maxEnd.setMonth(maxEnd.getMonth() + 3);
      if (end > maxEnd) {
        return badRequest("Date range cannot exceed 3 months");
      }
    }

    // Validate time window format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const earliestTime = body.earliestTime || "00:00";
    const latestTime = body.latestTime || "23:30";

    if (!timeRegex.test(earliestTime) || !timeRegex.test(latestTime)) {
      return badRequest("Invalid time format. Use HH:MM");
    }

    // Validate game system exists if provided
    if (body.gameSystemId) {
      const gameSystem = await prisma.gameSystem.findUnique({
        where: { id: body.gameSystemId },
      });
      if (!gameSystem) {
        return badRequest("Game system not found");
      }
    }

    // Validate meeting type enum
    let meetingType: MeetingType | null = null;
    if (body.meetingType) {
      const validTypes = Object.values(MeetingType);
      if (!validTypes.includes(body.meetingType as MeetingType)) {
        return badRequest("Invalid meeting type");
      }
      meetingType = body.meetingType as MeetingType;
    }

    // Validate campaign type enum
    let campaignType: CampaignType = CampaignType.CAMPAIGN;
    if (body.campaignType) {
      const validCampaignTypes = Object.values(CampaignType);
      if (!validCampaignTypes.includes(body.campaignType as CampaignType)) {
        return badRequest("Invalid campaign type");
      }
      campaignType = body.campaignType as CampaignType;
    }

    // Validate player counts if provided
    const minPlayers = body.minPlayers ? parseInt(body.minPlayers) : null;
    const maxPlayers = body.maxPlayers ? parseInt(body.maxPlayers) : null;
    if (minPlayers !== null && (isNaN(minPlayers) || minPlayers < 1)) {
      return badRequest("Minimum players must be at least 1");
    }
    if (maxPlayers !== null && (isNaN(maxPlayers) || maxPlayers < 1)) {
      return badRequest("Maximum players must be at least 1");
    }
    if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) {
      return badRequest("Minimum players cannot exceed maximum players");
    }

    const slug = await generateSlug(body.title);

    // Use a transaction to create both event and GM participant
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          slug,
          title: body.title.trim(),
          description: body.description?.trim() || null,
          timezone: body.timezone || "UTC",
          campaignType,

          // Game system
          gameSystemId: body.gameSystemId || null,

          // Campaign configuration
          campaignImageBase64: body.campaignImageBase64 || null,
          sessionLengthMinutes,
          customPreSessionInstructions: body.customPreSessionInstructions?.trim() || null,
          playerPrepUrls: body.playerPrepUrls || null,

          // Date range
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,

          // Time window - always 24hr, bounds derived from GM availability
          earliestTime,
          latestTime,

          // Meeting configuration
          meetingType,
          meetingLocation: body.meetingLocation?.trim() || null,
          meetingRoom: body.meetingRoom?.trim() || null,

          // Player limits
          minPlayers,
          maxPlayers,

          // Legacy fields (for backward compatibility)
          isRecurring: body.isRecurring || false,
          recurrencePattern: body.recurrencePattern || null,
          startTime: body.startTime ? new Date(body.startTime) : null,
          durationMinutes: body.durationMinutes || null,
        },
        include: {
          gameSystem: true,
        },
      });

      // Auto-create the GM participant
      const gmParticipant = await tx.participant.create({
        data: {
          eventId: event.id,
          displayName: "Game Master",
          isGm: true,
          timezone: body.timezone || "UTC",
        },
      });

      return { event, gmParticipant };
    });

    return created(result);
  } catch (error) {
    return handleApiError(error, "create campaign");
  }
}
