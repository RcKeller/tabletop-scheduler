import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { EventRow } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { rows } = await sql<EventRow>`
      SELECT * FROM events WHERE slug = ${slug}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const row = rows[0];
    const event = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      isRecurring: row.is_recurring,
      recurrencePattern: row.recurrence_pattern,
      startTime: row.start_time,
      durationMinutes: row.duration_minutes,
      timezone: row.timezone,
      createdAt: row.created_at,
    };

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}
