import { NextRequest, NextResponse } from "next/server";
import { parseAvailabilityText } from "@/lib/ai/availability-parser";

/**
 * Get the current date in the specified timezone
 */
function getCurrentDateInTimezone(timezone: string): string {
  try {
    // Format current time in the user's timezone to get their "today"
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA format gives us YYYY-MM-DD
    return formatter.format(new Date());
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Get the current day of week in the specified timezone
 */
function getCurrentDayInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    });
    return formatter.format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.text?.trim()) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const timezone = body.timezone || "UTC";

    // PREFER client-provided date/day (calculated in their browser with their clock)
    // Fall back to server calculation only if not provided
    const currentDateInUserTz = body.currentDate || getCurrentDateInTimezone(timezone);
    const currentDayInUserTz = body.currentDay || getCurrentDayInTimezone(timezone);

    console.log(`[parse] timezone=${timezone}, date=${currentDateInUserTz}, day=${currentDayInUserTz}`);

    const result = await parseAvailabilityText(
      body.text,
      timezone,
      currentDateInUserTz,
      currentDayInUserTz
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error parsing availability:", error);

    const message =
      error instanceof Error ? error.message : "Failed to parse availability";

    // Check for API key issues
    if (message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "AI parsing is not configured. Please add your API key." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
