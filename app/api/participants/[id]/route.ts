import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const participant = await prisma.participant.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    return NextResponse.json(participant);
  } catch (error) {
    console.error("Error fetching participant:", error);
    return NextResponse.json(
      { error: "Failed to fetch participant" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const participant = await prisma.participant.findUnique({
      where: { id },
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Only allow updating specific profile fields
    const updateData: {
      characterName?: string | null;
      characterClass?: string | null;
      characterSheetUrl?: string | null;
      characterTokenBase64?: string | null;
      notes?: string | null;
    } = {};

    if ("characterName" in body) {
      updateData.characterName = body.characterName?.trim() || null;
    }
    if ("characterClass" in body) {
      updateData.characterClass = body.characterClass?.trim() || null;
    }
    if ("characterSheetUrl" in body) {
      updateData.characterSheetUrl = body.characterSheetUrl?.trim() || null;
    }
    if ("characterTokenBase64" in body) {
      // Check size - base64 images can be large
      if (body.characterTokenBase64 && body.characterTokenBase64.length > 1.4 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image must be less than 1MB" },
          { status: 400 }
        );
      }
      updateData.characterTokenBase64 = body.characterTokenBase64 || null;
    }
    if ("notes" in body) {
      // Enforce 255 char limit on notes
      const trimmedNotes = body.notes?.trim() || null;
      updateData.notes = trimmedNotes ? trimmedNotes.slice(0, 255) : null;
    }

    // If no fields to update, just return current participant
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(participant);
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating participant:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update participant", details: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update participant display name (for rename functionality)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.participant.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const updateData: { displayName?: string } = {};

    if (body.displayName !== undefined) {
      const displayName = body.displayName?.trim();
      if (!displayName) {
        return NextResponse.json(
          { error: "Display name cannot be empty" },
          { status: 400 }
        );
      }

      // Check for duplicate name in same event
      const duplicate = await prisma.participant.findFirst({
        where: {
          eventId: existing.eventId,
          displayName: displayName,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A player with this name already exists in this campaign" },
          { status: 400 }
        );
      }

      updateData.displayName = displayName;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        id: existing.id,
        displayName: existing.displayName,
        isGm: existing.isGm,
      });
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      displayName: updated.displayName,
      isGm: updated.isGm,
    });
  } catch (error) {
    console.error("Error updating participant:", error);
    return NextResponse.json(
      { error: "Failed to update participant" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const participant = await prisma.participant.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Delete participant and all related data (cascade delete handles availability, etc.)
    await prisma.participant.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Participant removed" });
  } catch (error) {
    console.error("Error deleting participant:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to remove participant", details: message },
      { status: 500 }
    );
  }
}
