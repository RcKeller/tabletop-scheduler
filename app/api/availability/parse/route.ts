import { NextRequest, NextResponse } from "next/server";
import { parseAvailabilityText } from "@/lib/ai/availability-parser";

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

    const result = await parseAvailabilityText(body.text, timezone);

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
