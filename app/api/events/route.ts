import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateSlug } from "@/lib/utils/slug";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const slug = await generateSlug(body.title);

    const event = await prisma.event.create({
      data: {
        slug,
        title: body.title.trim(),
        description: body.description || null,
        isRecurring: body.isRecurring || false,
        recurrencePattern: body.recurrencePattern || null,
        startTime: body.startTime ? new Date(body.startTime) : null,
        durationMinutes: body.durationMinutes || null,
        timezone: body.timezone || "UTC",
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
