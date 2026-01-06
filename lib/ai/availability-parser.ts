import Anthropic from "@anthropic-ai/sdk";

interface ParsedPattern {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

interface ParsedSpecificSlot {
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

interface ParsedExclusion {
  date: string; // YYYY-MM-DD format
  startTime?: string; // HH:MM format, optional (if not provided, means whole day)
  endTime?: string; // HH:MM format
  reason?: string;
}

export interface ParseResult {
  // Weekly recurring patterns to ADD
  patterns: ParsedPattern[];
  // Specific date/times to ADD
  additions: ParsedSpecificSlot[];
  // Times when NOT available (exclusions)
  exclusions: ParsedExclusion[];
  // Human-readable interpretation
  interpretation: string;
  // Whether this replaces existing or adds to it
  mode: "replace" | "adjust";
}

const SYSTEM_PROMPT = `You are a helpful assistant that parses natural language availability descriptions into structured time data.

IMPORTANT: The user likely already has some availability set. Your job is to parse INCREMENTAL CHANGES, not their complete schedule. Default to mode="adjust" unless they're clearly stating their full schedule from scratch.

Your job is to:
1. Parse the user's availability/unavailability text
2. Identify if they're describing:
   - Recurring weekly patterns (e.g., "available evenings Mon-Fri")
   - Specific date additions (e.g., "also free Sunday January 12th")
   - Exclusions/unavailability (e.g., "not available Wednesday the 12th", "I have plans on the 15th")
3. Convert times to 24-hour format (HH:MM)
4. Convert relative dates to actual dates

Rules:
- dayOfWeek uses 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- All times should be in 24-hour format (e.g., "19:00" not "7:00 PM")
- Round times to the nearest 30-minute interval
- If a range spans multiple days (e.g., "weekdays"), create separate entries for each day
- "Evenings" generally means 17:00-22:00
- "Mornings" generally means 06:00-12:00
- "Afternoons" generally means 12:00-17:00
- "Weekdays" means Monday through Friday
- "Weekends" means Saturday and Sunday

DETECTING EXCLUSIONS:
- Look for negative phrases: "not available", "can't make it", "busy", "unavailable", "have plans", "won't be free", "except", "but not"
- Exclusions should go in the "exclusions" array, not patterns/additions
- If they say "I work 9-5" that means they're NOT available 9-5 (it's an exclusion/conflict)

MODE DETECTION - VERY IMPORTANT:
- DEFAULT to mode = "adjust" - this is the most common case
- Only use mode = "replace" if the user EXPLICITLY says something like:
  - "My availability is..." (defining complete schedule)
  - "I'm only available..." (exclusive/complete statement)
  - "Set my schedule to..." (explicit replacement)
  - "Clear my availability and set it to..." (explicit reset)
- Use mode = "adjust" for:
  - Adding specific dates: "also available Sunday", "free on the 15th"
  - Adding exclusions: "not available Wednesday", "busy on the 12th"
  - Partial additions: "can also do mornings"
  - Any statement that doesn't explicitly define a COMPLETE schedule
- When in doubt, use "adjust" - it's safer to add than to accidentally erase

Respond ONLY with valid JSON in this format:
{
  "patterns": [
    { "dayOfWeek": 1, "startTime": "18:00", "endTime": "22:00" }
  ],
  "additions": [
    { "date": "2026-01-12", "startTime": "17:00", "endTime": "19:00" }
  ],
  "exclusions": [
    { "date": "2026-01-14", "startTime": "17:00", "endTime": "22:00", "reason": "optional reason" }
  ],
  "interpretation": "Brief human-readable summary of what you understood",
  "mode": "replace" or "adjust"
}

Notes:
- patterns: recurring weekly availability - ONLY populate if user is defining/changing their weekly schedule
- additions: specific one-time dates to ADD availability (empty array if none)
- exclusions: specific times when NOT available (empty array if none)
- For whole-day exclusions, omit startTime and endTime
- PREFER additions/exclusions over patterns for partial statements`;

export async function parseAvailabilityText(
  text: string,
  timezone: string,
  currentDate?: string, // YYYY-MM-DD format for relative date resolution
  currentDay?: string // Current day of week (e.g., "Monday")
): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const today = currentDate || new Date().toISOString().split("T")[0];
  const todayDay = currentDay || new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Parse this availability description.

CRITICAL TIMEZONE CONTEXT:
- User's timezone: ${timezone}
- Today's date IN THE USER'S TIMEZONE: ${today}
- Today is: ${todayDay}

When the user says "Wednesday" or "this Wednesday", calculate the date based on THEIR timezone (${timezone}), not UTC.
For example, if today is ${todayDay} ${today} in ${timezone}:
- "this Wednesday" means the upcoming Wednesday from ${today}
- "next Wednesday" means the Wednesday after that
- "Wednesday the 15th" means specifically the 15th

User's input: "${text}"

Remember to respond with ONLY valid JSON.`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  // Extract text from response
  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParseResult;

    // Ensure arrays exist
    if (!Array.isArray(parsed.patterns)) {
      parsed.patterns = [];
    }
    if (!Array.isArray(parsed.additions)) {
      parsed.additions = [];
    }
    if (!Array.isArray(parsed.exclusions)) {
      parsed.exclusions = [];
    }
    if (!parsed.mode) {
      parsed.mode = "adjust";
    }

    // Validate patterns
    for (const slot of parsed.patterns) {
      if (
        typeof slot.dayOfWeek !== "number" ||
        slot.dayOfWeek < 0 ||
        slot.dayOfWeek > 6
      ) {
        throw new Error(`Invalid dayOfWeek: ${slot.dayOfWeek}`);
      }
      if (!/^\d{2}:\d{2}$/.test(slot.startTime)) {
        throw new Error(`Invalid startTime format: ${slot.startTime}`);
      }
      if (!/^\d{2}:\d{2}$/.test(slot.endTime)) {
        throw new Error(`Invalid endTime format: ${slot.endTime}`);
      }
    }

    // Validate additions
    for (const slot of parsed.additions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
        throw new Error(`Invalid date format: ${slot.date}`);
      }
      if (!/^\d{2}:\d{2}$/.test(slot.startTime)) {
        throw new Error(`Invalid startTime format: ${slot.startTime}`);
      }
      if (!/^\d{2}:\d{2}$/.test(slot.endTime)) {
        throw new Error(`Invalid endTime format: ${slot.endTime}`);
      }
    }

    // Validate exclusions
    for (const exc of parsed.exclusions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exc.date)) {
        throw new Error(`Invalid date format: ${exc.date}`);
      }
      if (exc.startTime && !/^\d{2}:\d{2}$/.test(exc.startTime)) {
        throw new Error(`Invalid startTime format: ${exc.startTime}`);
      }
      if (exc.endTime && !/^\d{2}:\d{2}$/.test(exc.endTime)) {
        throw new Error(`Invalid endTime format: ${exc.endTime}`);
      }
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse AI response:", responseText, error);
    throw new Error("Failed to parse availability. Please try a different description.");
  }
}

// Legacy support - converts old format to new
export function convertLegacyResult(result: { slots: ParsedPattern[]; interpretation: string }): ParseResult {
  return {
    patterns: result.slots,
    additions: [],
    exclusions: [],
    interpretation: result.interpretation,
    mode: "replace",
  };
}
