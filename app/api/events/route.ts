import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { generateSlug } from "@/lib/utils/slug";
import type { CreateEventRequest, EventRow, eventFromRow } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: CreateEventRequest = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const slug = await generateSlug(body.title);
    const timezone = body.timezone || "UTC";

    const { rows } = await sql<EventRow>`
      INSERT INTO events (
        slug,
        title,
        description,
        is_recurring,
        recurrence_pattern,
        start_time,
        duration_minutes,
        timezone
      ) VALUES (
        ${slug},
        ${body.title.trim()},
        ${body.description || null},
        ${body.isRecurring || false},
        ${body.recurrencePattern ? JSON.stringify(body.recurrencePattern) : null},
        ${body.startTime || null},
        ${body.durationMinutes || null},
        ${timezone}
      )
      RETURNING *
    `;

    const event = {
      id: rows[0].id,
      slug: rows[0].slug,
      title: rows[0].title,
      description: rows[0].description,
      isRecurring: rows[0].is_recurring,
      recurrencePattern: rows[0].recurrence_pattern,
      startTime: rows[0].start_time,
      durationMinutes: rows[0].duration_minutes,
      timezone: rows[0].timezone,
      createdAt: rows[0].created_at,
    };

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
