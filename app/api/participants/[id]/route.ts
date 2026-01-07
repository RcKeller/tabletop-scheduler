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
      updateData.characterTokenBase64 = body.characterTokenBase64 || null;
    }
    if ("notes" in body) {
      // Enforce 255 char limit on notes
      const trimmedNotes = body.notes?.trim() || null;
      updateData.notes = trimmedNotes ? trimmedNotes.slice(0, 255) : null;
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating participant:", error);
    return NextResponse.json(
      { error: "Failed to update participant" },
      { status: 500 }
    );
  }
}
