import { NextRequest, NextResponse } from "next/server";
import { parseAvailabilityWithRules, type ParseResultWithRules } from "@/lib/ai/availability-parser";

interface ParseRequest {
  text: string;
  timezone: string;
  participantId: string;
  currentDate?: string;
  currentDay?: string;
}

/**
 * POST /api/availability/parse
 * Parse natural language availability text using AI
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ParseResultWithRules | { error: string }>> {
  try {
    const body: ParseRequest = await request.json();

    // Validate required fields
    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    if (!body.timezone || typeof body.timezone !== "string") {
      return NextResponse.json(
        { error: "timezone is required" },
        { status: 400 }
      );
    }

    if (!body.participantId || typeof body.participantId !== "string") {
      return NextResponse.json(
        { error: "participantId is required" },
        { status: 400 }
      );
    }

    // Parse the availability text
    const result = await parseAvailabilityWithRules(
      body.text,
      body.timezone,
      body.participantId,
      body.currentDate,
      body.currentDay
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error parsing availability:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse availability" },
      { status: 500 }
    );
  }
}
