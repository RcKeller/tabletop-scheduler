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

// Meeting type enum (matches Prisma enum)
export type MeetingType =
  | "DISCORD"
  | "ZOOM"
  | "GOOGLE_MEET"
  | "ROLL20"
  | "FOUNDRY_VTT"
  | "IN_PERSON"
  | "OTHER";

// Player prep URL type
export interface PrepUrl {
  label: string;
  url: string;
}

// Game system type
export interface GameSystem {
  id: string;
  name: string;
  description: string | null;
  imageBase64: string | null;
  defaultInstructions: string | null;
  defaultUrls: PrepUrl[] | null;
  isBuiltIn: boolean;
  createdAt: string;
}

// Campaign creation payload
export interface CreateCampaignPayload {
  title: string;
  description?: string;
  timezone: string;
  gameSystemId?: string;
  campaignImageBase64?: string;
  sessionLengthMinutes: number;
  customPreSessionInstructions?: string;
  playerPrepUrls?: PrepUrl[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  earliestTime: string; // HH:MM
  latestTime: string; // HH:MM
  meetingType?: MeetingType;
  meetingLocation?: string;
  meetingRoom?: string;
}

// Campaign response (full event with game system)
export interface Campaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  createdAt: string;
  gameSystemId: string | null;
  gameSystem: GameSystem | null;
  campaignImageBase64: string | null;
  sessionLengthMinutes: number;
  customPreSessionInstructions: string | null;
  playerPrepUrls: PrepUrl[] | null;
  startDate: string | null;
  endDate: string | null;
  earliestTime: string;
  latestTime: string;
  meetingType: MeetingType | null;
  meetingLocation: string | null;
  meetingRoom: string | null;
}

// Meeting type configuration for UI
export interface MeetingTypeConfig {
  value: MeetingType;
  label: string;
  locationLabel: string;
  locationPlaceholder: string;
  roomLabel: string;
  roomPlaceholder: string;
}

export const MEETING_TYPE_CONFIG: MeetingTypeConfig[] = [
  {
    value: "DISCORD",
    label: "Discord",
    locationLabel: "Server Invite URL",
    locationPlaceholder: "https://discord.gg/...",
    roomLabel: "Voice Channel",
    roomPlaceholder: "e.g., #gaming-voice",
  },
  {
    value: "ZOOM",
    label: "Zoom",
    locationLabel: "Meeting URL",
    locationPlaceholder: "https://zoom.us/j/...",
    roomLabel: "Meeting ID",
    roomPlaceholder: "e.g., 123 456 7890",
  },
  {
    value: "GOOGLE_MEET",
    label: "Google Meet",
    locationLabel: "Meeting URL",
    locationPlaceholder: "https://meet.google.com/...",
    roomLabel: "Meeting Code",
    roomPlaceholder: "e.g., abc-defg-hij",
  },
  {
    value: "ROLL20",
    label: "Roll20",
    locationLabel: "Game URL",
    locationPlaceholder: "https://app.roll20.net/join/...",
    roomLabel: "Campaign Name",
    roomPlaceholder: "e.g., Curse of Strahd",
  },
  {
    value: "FOUNDRY_VTT",
    label: "Foundry VTT",
    locationLabel: "Server URL",
    locationPlaceholder: "https://your-foundry-server.com",
    roomLabel: "World Name",
    roomPlaceholder: "e.g., my-campaign",
  },
  {
    value: "IN_PERSON",
    label: "In-Person",
    locationLabel: "Address",
    locationPlaceholder: "e.g., 123 Main St, Apt 4B",
    roomLabel: "Additional Notes",
    roomPlaceholder: "e.g., Ring doorbell, 2nd floor",
  },
  {
    value: "OTHER",
    label: "Other",
    locationLabel: "Location / URL",
    locationPlaceholder: "Enter location or link",
    roomLabel: "Details",
    roomPlaceholder: "Additional information",
  },
];

// Session length options
export const SESSION_LENGTH_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 150, label: "2.5 hours" },
  { value: 180, label: "3 hours" },
  { value: 210, label: "3.5 hours" },
  { value: 240, label: "4 hours" },
  { value: 270, label: "4.5 hours" },
  { value: 300, label: "5 hours" },
  { value: 330, label: "5.5 hours" },
  { value: 360, label: "6 hours" },
  { value: 390, label: "6.5 hours" },
  { value: 420, label: "7 hours" },
  { value: 450, label: "7.5 hours" },
  { value: 480, label: "8 hours" },
];

// For API response types
export interface ParseAvailabilityResponse {
  slots: Omit<GeneralAvailability, "id" | "participantId">[];
  interpretation: string;
  isUnavailable?: boolean;
  operation?: "replace" | "add" | "remove";
}

// Heatmap cell type
export interface HeatmapCell {
  date: string;
  time: string;
  availableCount: number;
  availableParticipants: string[];
  totalParticipants: number;
}
