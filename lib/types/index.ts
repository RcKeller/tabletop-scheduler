// Utility types for overlap calculation and other shared logic
// Prisma generates the main model types in lib/generated/prisma

export interface TimeSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface GeneralAvailability {
  id: string;
  participantId: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, etc.
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface AvailabilityException {
  id: string;
  participantId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface OverlapSlot {
  date: string;
  startTime: string;
  endTime: string;
  availableCount: number;
  availableParticipants: string[];
  totalParticipants: number;
}

export interface OverlapResult {
  perfectSlots: OverlapSlot[];
  bestSlots: OverlapSlot[];
}

// For API response types
export interface ParseAvailabilityResponse {
  slots: Omit<GeneralAvailability, "id" | "participantId">[];
  interpretation: string;
}
