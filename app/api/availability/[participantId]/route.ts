import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format } from "date-fns";
import { computeEffectiveAvailability } from "@/lib/utils/availability-expander";
import { localToUTC } from "@/lib/utils/timezone";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await params;
    const { searchParams } = new URL(request.url);

    // Optional: get event context for computing effective availability
    const eventStartDate = searchParams.get("startDate");
    const eventEndDate = searchParams.get("endDate");
    const earliestTime = searchParams.get("earliestTime");
    const latestTime = searchParams.get("latestTime");
    // User's timezone for converting patterns (patterns are stored in user's local timezone)
    const userTimezone = searchParams.get("timezone") || "UTC";

    const [availability, generalAvailability, exceptions, participant] = await Promise.all([
      prisma.availability.findMany({
        where: { participantId },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      prisma.generalAvailability.findMany({
        where: { participantId },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.availabilityException.findMany({
        where: { participantId },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      prisma.participant.findUnique({
        where: { id: participantId },
        include: {
          event: {
            select: {
              startDate: true,
              endDate: true,
              earliestTime: true,
              latestTime: true,
            },
          },
        },
      }),
    ]);

    const formattedAvailability = availability.map((a) => ({
      ...a,
      date: format(a.date, "yyyy-MM-dd"),
    }));

    const formattedExceptions = exceptions.map((e) => ({
      ...e,
      date: format(e.date, "yyyy-MM-dd"),
    }));

    // Compute effective availability if we have event context
    let effectiveAvailability: Array<{ date: string; startTime: string; endTime: string }> = formattedAvailability.map((a) => ({
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
    }));

    const startDate = eventStartDate || (participant?.event?.startDate ? format(participant.event.startDate, "yyyy-MM-dd") : null);
    const endDate = eventEndDate || (participant?.event?.endDate ? format(participant.event.endDate, "yyyy-MM-dd") : null);
    const eventEarliestTime = earliestTime || participant?.event?.earliestTime;
    const eventLatestTime = latestTime || participant?.event?.latestTime;

    console.log("[API] Computing effectiveAvailability:", {
      startDate,
      endDate,
      userTimezone,
      patternsCount: generalAvailability.length,
      patterns: generalAvailability.map(p => ({ dayOfWeek: p.dayOfWeek, startTime: p.startTime, endTime: p.endTime })),
    });

    if (startDate && endDate) {
      // Separate patterns into available and unavailable
      const availablePatterns = generalAvailability.filter(p => p.isAvailable !== false);
      const unavailablePatterns = generalAvailability.filter(p => p.isAvailable === false);

      // Expand AVAILABLE patterns to specific slots
      const rawAvailable = computeEffectiveAvailability(
        availablePatterns.map((p) => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        [],
        [],
        startDate,
        endDate
      );

      // Convert available patterns from local timezone to UTC
      // Handle slots that cross midnight when converted
      const availablePatternsInUTC: Array<{ date: string; startTime: string; endTime: string }> = [];
      for (const slot of rawAvailable) {
        const start = localToUTC(slot.startTime, slot.date, userTimezone);
        const end = localToUTC(slot.endTime, slot.date, userTimezone);

        if (start.date === end.date) {
          // Same day - simple case
          if (start.time < end.time) {
            availablePatternsInUTC.push({
              date: start.date,
              startTime: start.time,
              endTime: end.time,
            });
          }
        } else {
          // Slot crosses midnight when converted to UTC - split into two slots
          // First slot: from start time to end of day
          availablePatternsInUTC.push({
            date: start.date,
            startTime: start.time,
            endTime: "23:59",
          });
          // Second slot: from start of day to end time
          availablePatternsInUTC.push({
            date: end.date,
            startTime: "00:00",
            endTime: end.time,
          });
        }
      }

      // Expand UNAVAILABLE patterns to specific slots (these become recurring blocked times)
      const rawUnavailable = computeEffectiveAvailability(
        unavailablePatterns.map((p) => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        [],
        [],
        startDate,
        endDate
      );

      // Convert unavailable patterns from local timezone to UTC
      // Handle slots that cross midnight when converted
      const blockedPatternsInUTC: Array<{ date: string; startTime: string; endTime: string }> = [];
      for (const slot of rawUnavailable) {
        const start = localToUTC(slot.startTime, slot.date, userTimezone);
        const end = localToUTC(slot.endTime, slot.date, userTimezone);

        if (start.date === end.date) {
          // Same day - simple case
          if (start.time < end.time) {
            blockedPatternsInUTC.push({
              date: start.date,
              startTime: start.time,
              endTime: end.time,
            });
          }
        } else {
          // Slot crosses midnight when converted to UTC - split into two slots
          blockedPatternsInUTC.push({
            date: start.date,
            startTime: start.time,
            endTime: "23:59",
          });
          blockedPatternsInUTC.push({
            date: end.date,
            startTime: "00:00",
            endTime: end.time,
          });
        }
      }

      // Combine available patterns with specific availability
      const allSlots = [...availablePatternsInUTC, ...formattedAvailability];

      // Combine stored exceptions with blocked pattern exceptions
      const allExceptions = [...formattedExceptions, ...blockedPatternsInUTC];

      // Apply ALL exceptions (both stored and from unavailable patterns)
      effectiveAvailability = allSlots.filter(slot => {
        return !allExceptions.some(exc =>
          exc.date === slot.date &&
          exc.startTime < slot.endTime &&
          exc.endTime > slot.startTime
        );
      });

      console.log("[API] Computed effectiveAvailability:", {
        availablePatternsCount: availablePatterns.length,
        unavailablePatternsCount: unavailablePatterns.length,
        rawAvailableCount: rawAvailable.length,
        rawAvailableSample: rawAvailable.slice(0, 5),
        availablePatternsInUTCCount: availablePatternsInUTC.length,
        availablePatternsInUTCSample: availablePatternsInUTC.slice(0, 8),
        blockedPatternsInUTCCount: blockedPatternsInUTC.length,
        specificSlotsCount: formattedAvailability.length,
        allSlotsCount: allSlots.length,
        allExceptionsCount: allExceptions.length,
        effectiveAvailabilityCount: effectiveAvailability.length,
        firstFewSlots: effectiveAvailability.slice(0, 5),
      });
    }

    return NextResponse.json({
      availability: formattedAvailability,
      generalAvailability,
      exceptions: formattedExceptions,
      effectiveAvailability, // This is what should be shown in the grid
      event: participant?.event ? {
        startDate: participant.event.startDate ? format(participant.event.startDate, "yyyy-MM-dd") : null,
        endDate: participant.event.endDate ? format(participant.event.endDate, "yyyy-MM-dd") : null,
        earliestTime: participant.event.earliestTime,
        latestTime: participant.event.latestTime,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await params;
    const body = await request.json();

    // Update participant's timezone if provided
    if (body.timezone) {
      await prisma.participant.update({
        where: { id: participantId },
        data: { timezone: body.timezone },
      });
    }

    // Handle event-specific availability
    if (body.availability !== undefined) {
      await prisma.availability.deleteMany({
        where: { participantId },
      });

      if (body.availability.length > 0) {
        await prisma.availability.createMany({
          data: body.availability.map((slot: { date: string; startTime: string; endTime: string }) => ({
            participantId,
            date: new Date(slot.date),
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        });
      }
    }

    // Handle general availability patterns
    if (body.generalAvailability !== undefined) {
      await prisma.generalAvailability.deleteMany({
        where: { participantId },
      });

      if (body.generalAvailability.length > 0) {
        await prisma.generalAvailability.createMany({
          data: body.generalAvailability.map((pattern: { dayOfWeek: number; startTime: string; endTime: string; isAvailable?: boolean }) => ({
            participantId,
            dayOfWeek: pattern.dayOfWeek,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            isAvailable: pattern.isAvailable ?? true,
          })),
        });
      }
      // NOTE: We no longer clear specific availability when patterns are saved
      // This allows Calendar entries to coexist with Recurring patterns
    }

    // Handle exceptions
    if (body.exceptions !== undefined) {
      // Check if we should append to existing exceptions or replace them
      const appendMode = body.appendExceptions === true;

      if (!appendMode) {
        // Replace mode: delete existing exceptions first
        await prisma.availabilityException.deleteMany({
          where: { participantId },
        });
      }

      if (body.exceptions.length > 0) {
        if (appendMode) {
          // Append mode: add only new exceptions (avoid duplicates)
          const existingExceptions = await prisma.availabilityException.findMany({
            where: { participantId },
            select: { date: true, startTime: true, endTime: true },
          });

          const existingSet = new Set(
            existingExceptions.map(e =>
              `${format(e.date, "yyyy-MM-dd")}|${e.startTime}|${e.endTime}`
            )
          );

          const newExceptions = body.exceptions.filter(
            (exc: { date: string; startTime: string; endTime: string }) =>
              !existingSet.has(`${exc.date}|${exc.startTime}|${exc.endTime}`)
          );

          if (newExceptions.length > 0) {
            await prisma.availabilityException.createMany({
              data: newExceptions.map((exception: { date: string; startTime: string; endTime: string; reason?: string }) => ({
                participantId,
                date: new Date(exception.date),
                startTime: exception.startTime,
                endTime: exception.endTime,
                reason: exception.reason || null,
              })),
            });
          }
        } else {
          // Replace mode: just create all exceptions
          await prisma.availabilityException.createMany({
            data: body.exceptions.map((exception: { date: string; startTime: string; endTime: string; reason?: string }) => ({
              participantId,
              date: new Date(exception.date),
              startTime: exception.startTime,
              endTime: exception.endTime,
              reason: exception.reason || null,
            })),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    );
  }
}
