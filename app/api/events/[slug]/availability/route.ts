import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { calculateOverlap } from "@/lib/utils/overlap";
import type {
  EventRow,
  ParticipantRow,
  AvailabilityRow,
  GeneralAvailabilityRow,
  AvailabilityExceptionRow,
} from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get event
    const { rows: eventRows } = await sql<EventRow>`
      SELECT id FROM events WHERE slug = ${slug}
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventId = eventRows[0].id;

    // Get all participants
    const { rows: participantRows } = await sql<ParticipantRow>`
      SELECT * FROM participants WHERE event_id = ${eventId}
    `;

    if (participantRows.length === 0) {
      return NextResponse.json({
        overlap: { perfectSlots: [], bestSlots: [] },
        participants: [],
      });
    }

    // Fetch all availability data for each participant
    const allAvailability: AvailabilityRow[] = [];
    const allGeneral: GeneralAvailabilityRow[] = [];
    const allExceptions: AvailabilityExceptionRow[] = [];

    for (const p of participantRows) {
      const [avail, general, exceptions] = await Promise.all([
        sql<AvailabilityRow>`
          SELECT * FROM availability WHERE participant_id = ${p.id}
        `,
        sql<GeneralAvailabilityRow>`
          SELECT * FROM general_availability WHERE participant_id = ${p.id}
        `,
        sql<AvailabilityExceptionRow>`
          SELECT * FROM availability_exceptions WHERE participant_id = ${p.id}
        `,
      ]);
      allAvailability.push(...avail.rows);
      allGeneral.push(...general.rows);
      allExceptions.push(...exceptions.rows);
    }

    const availabilityResult = { rows: allAvailability };
    const generalResult = { rows: allGeneral };
    const exceptionsResult = { rows: allExceptions };

    // Organize data by participant
    const participantData = participantRows.map((p) => ({
      participantId: p.id,
      displayName: p.display_name,
      availability: availabilityResult.rows
        .filter((a) => a.participant_id === p.id)
        .map((a) => ({
          date: a.date,
          startTime: a.start_time,
          endTime: a.end_time,
        })),
      generalAvailability: generalResult.rows
        .filter((g) => g.participant_id === p.id)
        .map((g) => ({
          id: g.id,
          participantId: g.participant_id,
          dayOfWeek: g.day_of_week,
          startTime: g.start_time,
          endTime: g.end_time,
        })),
      exceptions: exceptionsResult.rows
        .filter((e) => e.participant_id === p.id)
        .map((e) => ({
          id: e.id,
          participantId: e.participant_id,
          date: e.date,
          startTime: e.start_time,
          endTime: e.end_time,
          reason: e.reason,
        })),
    }));

    // Calculate overlap
    const overlap = calculateOverlap(participantData);

    // Build participant name map
    const participantNames: Record<string, string> = {};
    for (const p of participantRows) {
      participantNames[p.id] = p.display_name;
    }

    return NextResponse.json({
      overlap,
      participants: participantRows.map((p) => ({
        id: p.id,
        displayName: p.display_name,
        isGm: p.is_gm,
        hasAvailability:
          availabilityResult.rows.some((a) => a.participant_id === p.id) ||
          generalResult.rows.some((g) => g.participant_id === p.id),
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
