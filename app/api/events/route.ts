import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSlug } from "@/lib/utils/slug";
import { MeetingType } from "@/lib/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    // Validate session length
    const sessionLengthMinutes = body.sessionLengthMinutes || 180;
    if (sessionLengthMinutes < 60 || sessionLengthMinutes > 480) {
      return NextResponse.json(
        { error: "Session length must be between 1 and 8 hours" },
        { status: 400 }
      );
    }

    // Validate date range if provided
    if (body.startDate && body.endDate) {
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      if (end < start) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }

      // Check max 3 months
      const maxEnd = new Date(start);
      maxEnd.setMonth(maxEnd.getMonth() + 3);
      if (end > maxEnd) {
        return NextResponse.json(
          { error: "Date range cannot exceed 3 months" },
          { status: 400 }
        );
      }
    }

    // Validate time window format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const earliestTime = body.earliestTime || "00:00";
    const latestTime = body.latestTime || "23:30";

    if (!timeRegex.test(earliestTime) || !timeRegex.test(latestTime)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM" },
        { status: 400 }
      );
    }

    // Validate game system exists if provided
    if (body.gameSystemId) {
      const gameSystem = await prisma.gameSystem.findUnique({
        where: { id: body.gameSystemId },
      });
      if (!gameSystem) {
        return NextResponse.json(
          { error: "Game system not found" },
          { status: 400 }
        );
      }
    }

    // Validate meeting type enum
    let meetingType: MeetingType | null = null;
    if (body.meetingType) {
      const validTypes = Object.values(MeetingType);
      if (!validTypes.includes(body.meetingType as MeetingType)) {
        return NextResponse.json(
          { error: "Invalid meeting type" },
          { status: 400 }
        );
      }
      meetingType = body.meetingType as MeetingType;
    }

    const slug = await generateSlug(body.title);

    const event = await prisma.event.create({
      data: {
        slug,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        timezone: body.timezone || "UTC",

        // Game system
        gameSystemId: body.gameSystemId || null,

        // Campaign configuration
        campaignImageBase64: body.campaignImageBase64 || null,
        sessionLengthMinutes,
        customPreSessionInstructions: body.customPreSessionInstructions?.trim() || null,

        // Date range
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,

        // Time window
        earliestTime,
        latestTime,

        // Meeting configuration
        meetingType,
        meetingLocation: body.meetingLocation?.trim() || null,
        meetingRoom: body.meetingRoom?.trim() || null,

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

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
