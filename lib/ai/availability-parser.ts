import Anthropic from "@anthropic-ai/sdk";

interface ParsedAvailability {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

interface ParseResult {
  slots: ParsedAvailability[];
  interpretation: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant that parses natural language availability descriptions into structured time slots.

Your job is to:
1. Parse the user's availability text
2. Convert times to 24-hour format (HH:MM)
3. Return a JSON object with the parsed slots

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

Respond ONLY with valid JSON in this format:
{
  "slots": [
    { "dayOfWeek": 1, "startTime": "18:00", "endTime": "22:00" }
  ],
  "interpretation": "Brief human-readable summary of what you understood"
}`;

export async function parseAvailabilityText(
  text: string,
  timezone: string
): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Parse this availability description. The user is in the ${timezone} timezone.

"${text}"

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

    // Validate the structure
    if (!Array.isArray(parsed.slots)) {
      throw new Error("Invalid response structure: missing slots array");
    }

    // Validate each slot
    for (const slot of parsed.slots) {
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

    return parsed;
  } catch (error) {
    console.error("Failed to parse AI response:", responseText, error);
    throw new Error("Failed to parse availability. Please try a different description.");
  }
}
