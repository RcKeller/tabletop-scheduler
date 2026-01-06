import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { EventRow, ParticipantRow } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get event first
    const { rows: eventRows } = await sql<EventRow>`
      SELECT id FROM events WHERE slug = ${slug}
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventId = eventRows[0].id;

    // Get participants
    const { rows } = await sql<ParticipantRow>`
      SELECT * FROM participants
      WHERE event_id = ${eventId}
      ORDER BY created_at ASC
    `;

    const participants = rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      displayName: row.display_name,
      isGm: row.is_gm,
      createdAt: row.created_at,
    }));

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

    // Get event first
    const { rows: eventRows } = await sql<EventRow>`
      SELECT id FROM events WHERE slug = ${slug}
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventId = eventRows[0].id;
    const displayName = body.displayName.trim();
    const isGm = body.isGm || false;

    // Check if name already taken
    const { rows: existing } = await sql<ParticipantRow>`
      SELECT * FROM participants
      WHERE event_id = ${eventId} AND display_name = ${displayName}
    `;

    if (existing.length > 0) {
      // Return existing participant (rejoin)
      const row = existing[0];
      return NextResponse.json({
        id: row.id,
        eventId: row.event_id,
        displayName: row.display_name,
        isGm: row.is_gm,
        createdAt: row.created_at,
      });
    }

    // Create new participant
    const { rows } = await sql<ParticipantRow>`
      INSERT INTO participants (event_id, display_name, is_gm)
      VALUES (${eventId}, ${displayName}, ${isGm})
      RETURNING *
    `;

    const row = rows[0];
    const participant = {
      id: row.id,
      eventId: row.event_id,
      displayName: row.display_name,
      isGm: row.is_gm,
      createdAt: row.created_at,
    };

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("Error creating participant:", error);
    return NextResponse.json(
      { error: "Failed to join event" },
      { status: 500 }
    );
  }
}
