import { addDays, startOfWeek, format, parse } from "date-fns";
import type { TimeSlot, GeneralAvailability, AvailabilityException, OverlapSlot, OverlapResult } from "@/lib/types";

interface ParticipantAvailability {
  participantId: string;
  displayName: string;
  availability: TimeSlot[];
  generalAvailability: GeneralAvailability[];
  exceptions: AvailabilityException[];
}

// Generate 30-min slots for a time range
function generateSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  let current = startTime;

  while (current < endTime) {
    slots.push(current);
    const [h, m] = current.split(":").map(Number);
    const nextMinute = m + 30;
    if (nextMinute >= 60) {
      current = `${(h + 1).toString().padStart(2, "0")}:00`;
    } else {
      current = `${h.toString().padStart(2, "0")}:30`;
    }
  }

  return slots;
}

// Expand general availability to specific dates for the next 7 days
function expandGeneralAvailability(
  patterns: GeneralAvailability[],
  exceptions: AvailabilityException[]
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();

    // Find patterns for this day
    const dayPatterns = patterns.filter((p) => p.dayOfWeek === dayOfWeek);

    // Find exceptions for this date
    const dayExceptions = exceptions.filter((e) => e.date === dateStr);

    // Generate available slots
    const availableSlots = new Set<string>();

    for (const pattern of dayPatterns) {
      const slots = generateSlots(pattern.startTime, pattern.endTime);
      for (const slot of slots) {
        availableSlots.add(slot);
      }
    }

    // Remove exception times
    for (const exception of dayExceptions) {
      const blockedSlots = generateSlots(exception.startTime, exception.endTime);
      for (const slot of blockedSlots) {
        availableSlots.delete(slot);
      }
    }

    if (availableSlots.size > 0) {
      result.set(dateStr, availableSlots);
    }
  }

  return result;
}

// Convert specific availability to the same format
function convertSpecificAvailability(
  availability: TimeSlot[]
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  for (const slot of availability) {
    const slots = generateSlots(slot.startTime, slot.endTime);
    const existing = result.get(slot.date) || new Set<string>();
    for (const s of slots) {
      existing.add(s);
    }
    result.set(slot.date, existing);
  }

  return result;
}

export function calculateOverlap(
  participants: ParticipantAvailability[]
): OverlapResult {
  if (participants.length === 0) {
    return { perfectSlots: [], bestSlots: [] };
  }

  // Convert each participant's availability to Map<date, Set<time slots>>
  const participantSlots: Map<string, Map<string, Set<string>>> = new Map();

  for (const p of participants) {
    // Prefer specific availability, fall back to general
    let slots: Map<string, Set<string>>;

    if (p.availability.length > 0) {
      slots = convertSpecificAvailability(p.availability);
    } else if (p.generalAvailability.length > 0) {
      slots = expandGeneralAvailability(p.generalAvailability, p.exceptions);
    } else {
      slots = new Map();
    }

    participantSlots.set(p.participantId, slots);
  }

  // Find all unique date-time combinations
  const allSlots = new Map<string, { count: number; participants: string[] }>();

  for (const [participantId, dateSlots] of participantSlots) {
    for (const [date, timeSlots] of dateSlots) {
      for (const time of timeSlots) {
        const key = `${date}|${time}`;
        const existing = allSlots.get(key) || { count: 0, participants: [] };
        existing.count++;
        existing.participants.push(participantId);
        allSlots.set(key, existing);
      }
    }
  }

  // Convert to OverlapSlot format and sort
  const overlapSlots: OverlapSlot[] = [];

  for (const [key, data] of allSlots) {
    const [date, startTime] = key.split("|");
    const [h, m] = startTime.split(":").map(Number);
    const endMinute = m + 30;
    const endTime = endMinute >= 60
      ? `${(h + 1).toString().padStart(2, "0")}:00`
      : `${h.toString().padStart(2, "0")}:30`;

    overlapSlots.push({
      date,
      startTime,
      endTime,
      availableCount: data.count,
      availableParticipants: data.participants,
      totalParticipants: participants.length,
    });
  }

  // Sort by count (descending), then date, then time
  overlapSlots.sort((a, b) => {
    if (b.availableCount !== a.availableCount) {
      return b.availableCount - a.availableCount;
    }
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.startTime.localeCompare(b.startTime);
  });

  // Merge contiguous slots into ranges
  const mergeSlots = (slots: OverlapSlot[]): OverlapSlot[] => {
    if (slots.length === 0) return [];

    const merged: OverlapSlot[] = [];
    let current = { ...slots[0] };

    for (let i = 1; i < slots.length; i++) {
      const slot = slots[i];
      // Check if contiguous (same date, same participants, endTime matches startTime)
      if (
        slot.date === current.date &&
        slot.startTime === current.endTime &&
        slot.availableCount === current.availableCount &&
        JSON.stringify(slot.availableParticipants.sort()) ===
          JSON.stringify(current.availableParticipants.sort())
      ) {
        current.endTime = slot.endTime;
      } else {
        merged.push(current);
        current = { ...slot };
      }
    }
    merged.push(current);

    return merged;
  };

  // Perfect slots: everyone available
  const perfectSlots = mergeSlots(
    overlapSlots.filter((s) => s.availableCount === participants.length)
  );

  // Best slots: at least half available (but not perfect)
  const minForBest = Math.ceil(participants.length / 2);
  const bestSlots = mergeSlots(
    overlapSlots.filter(
      (s) =>
        s.availableCount >= minForBest &&
        s.availableCount < participants.length
    )
  ).slice(0, 10); // Limit to top 10

  return { perfectSlots: perfectSlots.slice(0, 10), bestSlots };
}
