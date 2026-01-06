import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { AvailabilityRow, GeneralAvailabilityRow, AvailabilityExceptionRow } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await params;

    // Get event-specific availability
    const { rows: availabilityRows } = await sql<AvailabilityRow>`
      SELECT * FROM availability
      WHERE participant_id = ${participantId}
      ORDER BY date, start_time
    `;

    // Get general availability patterns
    const { rows: generalRows } = await sql<GeneralAvailabilityRow>`
      SELECT * FROM general_availability
      WHERE participant_id = ${participantId}
      ORDER BY day_of_week, start_time
    `;

    // Get exceptions
    const { rows: exceptionRows } = await sql<AvailabilityExceptionRow>`
      SELECT * FROM availability_exceptions
      WHERE participant_id = ${participantId}
      ORDER BY date, start_time
    `;

    return NextResponse.json({
      availability: availabilityRows.map((row) => ({
        id: row.id,
        participantId: row.participant_id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
      })),
      generalAvailability: generalRows.map((row) => ({
        id: row.id,
        participantId: row.participant_id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
      })),
      exceptions: exceptionRows.map((row) => ({
        id: row.id,
        participantId: row.participant_id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        reason: row.reason,
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
      // Delete existing availability for this participant
      await sql`
        DELETE FROM availability WHERE participant_id = ${participantId}
      `;

      // Insert new availability
      for (const slot of body.availability) {
        await sql`
          INSERT INTO availability (participant_id, date, start_time, end_time)
          VALUES (${participantId}, ${slot.date}, ${slot.startTime}, ${slot.endTime})
        `;
      }
    }

    // Handle general availability patterns
    if (body.generalAvailability !== undefined) {
      // Delete existing general availability
      await sql`
        DELETE FROM general_availability WHERE participant_id = ${participantId}
      `;

      // Insert new patterns
      for (const pattern of body.generalAvailability) {
        await sql`
          INSERT INTO general_availability (participant_id, day_of_week, start_time, end_time)
          VALUES (${participantId}, ${pattern.dayOfWeek}, ${pattern.startTime}, ${pattern.endTime})
        `;
      }
    }

    // Handle exceptions
    if (body.exceptions !== undefined) {
      // Delete existing exceptions
      await sql`
        DELETE FROM availability_exceptions WHERE participant_id = ${participantId}
      `;

      // Insert new exceptions
      for (const exception of body.exceptions) {
        await sql`
          INSERT INTO availability_exceptions (participant_id, date, start_time, end_time, reason)
          VALUES (${participantId}, ${exception.date}, ${exception.startTime}, ${exception.endTime}, ${exception.reason || null})
        `;
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
