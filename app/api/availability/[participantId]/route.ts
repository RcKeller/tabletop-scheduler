import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format } from "date-fns";
import { computeEffectiveAvailability } from "@/lib/utils/availability-expander";

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

    if (startDate && endDate) {
      effectiveAvailability = computeEffectiveAvailability(
        generalAvailability.map((p) => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        formattedAvailability,
        formattedExceptions,
        startDate,
        endDate,
        eventEarliestTime || undefined,
        eventLatestTime || undefined
      );
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
          data: body.generalAvailability.map((pattern: { dayOfWeek: number; startTime: string; endTime: string }) => ({
            participantId,
            dayOfWeek: pattern.dayOfWeek,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
          })),
        });
      }

      // When patterns are saved, clear specific availability so patterns become the source of truth
      // This ensures patterns and grid are synchronized
      if (body.clearSpecificOnPatternSave !== false) {
        await prisma.availability.deleteMany({
          where: { participantId },
        });
      }
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
