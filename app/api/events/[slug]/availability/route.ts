import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateOverlap } from "@/lib/utils/overlap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const participants = await prisma.participant.findMany({
      where: { eventId: event.id },
      include: {
        availability: true,
        generalAvailability: true,
        exceptions: true,
      },
    });

    if (participants.length === 0) {
      return NextResponse.json({
        overlap: { perfectSlots: [], bestSlots: [] },
        participants: [],
        participantNames: {},
      });
    }

    // Format data for overlap calculation
    const participantData = participants.map((p) => ({
      participantId: p.id,
      displayName: p.displayName,
      availability: p.availability.map((a) => ({
        date: a.date.toISOString().split("T")[0],
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      generalAvailability: p.generalAvailability.map((g) => ({
        id: g.id,
        participantId: g.participantId,
        dayOfWeek: g.dayOfWeek,
        startTime: g.startTime,
        endTime: g.endTime,
      })),
      exceptions: p.exceptions.map((e) => ({
        id: e.id,
        participantId: e.participantId,
        date: e.date.toISOString().split("T")[0],
        startTime: e.startTime,
        endTime: e.endTime,
        reason: e.reason,
      })),
    }));

    const overlap = calculateOverlap(participantData);

    const participantNames: Record<string, string> = {};
    for (const p of participants) {
      participantNames[p.id] = p.displayName;
    }

    return NextResponse.json({
      overlap,
      participants: participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isGm: p.isGm,
        hasAvailability: p.availability.length > 0 || p.generalAvailability.length > 0,
      })),
      participantNames,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
