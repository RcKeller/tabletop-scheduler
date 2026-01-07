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

interface RoutineRemoval {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc. - Remove this day entirely from routine
  startTime?: string; // Optional: only remove a specific time range
  endTime?: string;
}

export interface ParseResult {
  // Weekly recurring patterns to ADD
  patterns: ParsedPattern[];
  // Specific date/times to ADD
  additions: ParsedSpecificSlot[];
  // Times when NOT available (exclusions) - specific dates only
  exclusions: ParsedExclusion[];
  // Days to REMOVE from weekly routine (e.g., "not available on mondays")
  routineRemovals: RoutineRemoval[];
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
   - Recurring weekly patterns (e.g., "available evenings Mon-Fri") -> patterns
   - Specific date additions (e.g., "also free Sunday January 12th") -> additions
   - Specific date unavailability (e.g., "busy on January 15th") -> exclusions
   - RECURRING unavailability (e.g., "not available on mondays", "can't do weekends") -> routineRemovals
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

DETECTING UNAVAILABILITY - CRITICAL:
- Look for: "not available", "can't make it", "busy", "unavailable", "have plans", "won't be free", "except", "but not", "never", "don't work for me"
- If they say "I work 9-5 M-F" -> routineRemovals for Mon-Fri 9-5
- If they say "not available on mondays" or "mondays don't work" -> routineRemovals for Monday (entire day)
- If they say "busy this Thursday" -> exclusions for specific date
- RECURRING unavailability (day names without "this/next/the") -> routineRemovals
- SPECIFIC DATE unavailability (with "this/next/the" or actual dates) -> exclusions

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
  - Removing from routine: "can't do mondays", "weekends don't work"
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
  "routineRemovals": [
    { "dayOfWeek": 1 }
  ],
  "interpretation": "Brief human-readable summary of what you understood",
  "mode": "replace" or "adjust"
}

Notes:
- patterns: recurring weekly availability - ONLY populate if user is defining/changing their weekly schedule
- additions: specific one-time dates to ADD availability (empty array if none)
- exclusions: specific dates when NOT available (empty array if none) - use for ONE-TIME unavailability
- routineRemovals: days to REMOVE from weekly routine (empty array if none) - use for RECURRING unavailability
  - For whole-day removal, just provide dayOfWeek
  - For partial removal, also provide startTime and endTime (e.g., "no mornings on Monday")
- For whole-day exclusions, omit startTime and endTime
- PREFER routineRemovals for recurring unavailability, exclusions for one-time dates`;

/**
 * Calculate upcoming dates for each day of the week from a given start date
 */
function getUpcomingDates(startDateStr: string): Record<string, string> {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const result: Record<string, string> = {};

  // Parse the start date
  const [year, month, day] = startDateStr.split("-").map(Number);
  const startDate = new Date(year, month - 1, day); // Local date
  const startDayOfWeek = startDate.getDay();

  for (let i = 0; i < 7; i++) {
    const dayIndex = (startDayOfWeek + i) % 7;
    const dayName = dayNames[dayIndex];
    const futureDate = new Date(year, month - 1, day + i);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
    result[dayName] = dateStr;
  }

  return result;
}

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

  // Pre-calculate the dates for each upcoming day of the week
  const upcomingDates = getUpcomingDates(today);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Parse this availability description.

CRITICAL DATE CONTEXT (use these EXACT dates):
- Timezone: ${timezone}
- Today is: ${todayDay}, ${today}

UPCOMING DATES (use these when user mentions a day name):
- Sunday = ${upcomingDates["Sunday"]}
- Monday = ${upcomingDates["Monday"]}
- Tuesday = ${upcomingDates["Tuesday"]}
- Wednesday = ${upcomingDates["Wednesday"]}
- Thursday = ${upcomingDates["Thursday"]}
- Friday = ${upcomingDates["Friday"]}
- Saturday = ${upcomingDates["Saturday"]}

IMPORTANT: When user says "Wednesday", use ${upcomingDates["Wednesday"]}. Do NOT calculate dates yourself - use the dates listed above.

User's input: "${text}"

Respond with ONLY valid JSON.`,
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
    if (!Array.isArray(parsed.routineRemovals)) {
      parsed.routineRemovals = [];
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

    // Validate routine removals
    for (const removal of parsed.routineRemovals) {
      if (
        typeof removal.dayOfWeek !== "number" ||
        removal.dayOfWeek < 0 ||
        removal.dayOfWeek > 6
      ) {
        throw new Error(`Invalid dayOfWeek in routineRemoval: ${removal.dayOfWeek}`);
      }
      if (removal.startTime && !/^\d{2}:\d{2}$/.test(removal.startTime)) {
        throw new Error(`Invalid startTime format: ${removal.startTime}`);
      }
      if (removal.endTime && !/^\d{2}:\d{2}$/.test(removal.endTime)) {
        throw new Error(`Invalid endTime format: ${removal.endTime}`);
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
    routineRemovals: [],
    interpretation: result.interpretation,
    mode: "replace",
  };
}
