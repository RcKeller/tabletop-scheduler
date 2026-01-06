import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await params;

    const [availability, generalAvailability, exceptions] = await Promise.all([
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
    ]);

    return NextResponse.json({
      availability: availability.map((a) => ({
        ...a,
        date: a.date.toISOString().split("T")[0],
      })),
      generalAvailability,
      exceptions: exceptions.map((e) => ({
        ...e,
        date: e.date.toISOString().split("T")[0],
      })),
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
    }

    // Handle exceptions
    if (body.exceptions !== undefined) {
      await prisma.availabilityException.deleteMany({
        where: { participantId },
      });

      if (body.exceptions.length > 0) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    );
  }
}
