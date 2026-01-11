import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MeetingType } from "@/lib/generated/prisma";
import { badRequest, notFound, success, handleApiError } from "@/lib/api/response";
import { getGmAvailabilityBounds } from "@/lib/utils/gm-availability";
import type { GeneralAvailability, TimeSlot } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        gameSystem: true,
      },
    });

    if (!event) {
      return notFound("Campaign");
    }

    // Calculate GM availability bounds for player callouts
    let gmAvailabilityBounds: { earliest: string | null; latest: string | null } = {
      earliest: null,
      latest: null,
    };

    // Fetch GM participant separately with their availability
    const gmParticipant = await prisma.participant.findFirst({
      where: { eventId: event.id, isGm: true },
      include: {
        availability: true,
        generalAvailability: true,
      },
    });

    if (gmParticipant) {
      const patterns = gmParticipant.generalAvailability.map((ga) => ({
        id: ga.id,
        participantId: ga.participantId,
        dayOfWeek: ga.dayOfWeek,
        startTime: ga.startTime,
        endTime: ga.endTime,
        isAvailable: ga.isAvailable,
      })) as GeneralAvailability[];

      // TimeSlots from specific dates don't have isAvailable - if they exist, they're available
      const slots = gmParticipant.availability.map((a) => ({
        date: a.date.toISOString().split("T")[0],
        startTime: a.startTime,
        endTime: a.endTime,
      })) as TimeSlot[];

      gmAvailabilityBounds = getGmAvailabilityBounds(patterns, slots);
    }

    return success({
      ...event,
      gmAvailabilityBounds,
    });
  } catch (error) {
    return handleApiError(error, "fetch campaign");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Verify event exists
    const existing = await prisma.event.findUnique({
      where: { slug },
    });

    if (!existing) {
      return notFound("Campaign");
    }

    // Validate session length if provided
    if (body.sessionLengthMinutes !== undefined) {
      const sessionLength = body.sessionLengthMinutes;
      if (sessionLength < 60 || sessionLength > 480) {
        return badRequest("Session length must be between 1 and 8 hours");
      }
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
    if (body.earliestTime && !timeRegex.test(body.earliestTime)) {
      return badRequest("Invalid earliest time format. Use HH:MM");
    }
    if (body.latestTime && !timeRegex.test(body.latestTime)) {
      return badRequest("Invalid latest time format. Use HH:MM");
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
    if (body.meetingType) {
      const validTypes = Object.values(MeetingType);
      if (!validTypes.includes(body.meetingType as MeetingType)) {
        return badRequest("Invalid meeting type");
      }
    }

    // Validate player counts if provided
    const minPlayers = body.minPlayers !== undefined ? body.minPlayers : existing.minPlayers;
    const maxPlayers = body.maxPlayers !== undefined ? body.maxPlayers : existing.maxPlayers;
    if (minPlayers !== null && (isNaN(minPlayers) || minPlayers < 1)) {
      return badRequest("Minimum players must be at least 1");
    }
    if (maxPlayers !== null && (isNaN(maxPlayers) || maxPlayers < 1)) {
      return badRequest("Maximum players must be at least 1");
    }
    if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) {
      return badRequest("Minimum players cannot exceed maximum players");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.gameSystemId !== undefined) updateData.gameSystemId = body.gameSystemId || null;
    if (body.sessionLengthMinutes !== undefined) updateData.sessionLengthMinutes = body.sessionLengthMinutes;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.earliestTime !== undefined) updateData.earliestTime = body.earliestTime;
    if (body.latestTime !== undefined) updateData.latestTime = body.latestTime;
    if (body.meetingType !== undefined) updateData.meetingType = body.meetingType || null;
    if (body.meetingLocation !== undefined) updateData.meetingLocation = body.meetingLocation?.trim() || null;
    if (body.meetingRoom !== undefined) updateData.meetingRoom = body.meetingRoom?.trim() || null;
    if (body.customPreSessionInstructions !== undefined) {
      updateData.customPreSessionInstructions = body.customPreSessionInstructions?.trim() || null;
    }
    if (body.playerPrepUrls !== undefined) updateData.playerPrepUrls = body.playerPrepUrls || null;
    if (body.minPlayers !== undefined) updateData.minPlayers = body.minPlayers;
    if (body.maxPlayers !== undefined) updateData.maxPlayers = body.maxPlayers;

    const event = await prisma.event.update({
      where: { slug },
      data: updateData,
      include: {
        gameSystem: true,
      },
    });

    return success(event);
  } catch (error) {
    return handleApiError(error, "update campaign");
  }
}
