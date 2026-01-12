import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(participants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Failed to fetch participants" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    if (!body.displayName?.trim()) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const displayName = body.displayName.trim();

    // Check if name already taken (upsert - return existing or create new)
    const existing = await prisma.participant.findUnique({
      where: {
        eventId_displayName: {
          eventId: event.id,
          displayName,
        },
      },
    });

    if (existing) {
      // Update timezone if provided and participant exists (re-joining)
      if (body.timezone && existing.timezone !== body.timezone) {
        const updated = await prisma.participant.update({
          where: { id: existing.id },
          data: { timezone: body.timezone },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    const participant = await prisma.participant.create({
      data: {
        eventId: event.id,
        displayName,
        isGm: body.isGm || false,
        timezone: body.timezone || "UTC",
      },
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("Error creating participant:", error);
    return NextResponse.json(
      { error: "Failed to join event" },
      { status: 500 }
    );
  }
}
