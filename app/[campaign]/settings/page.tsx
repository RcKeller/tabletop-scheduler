import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { CampaignSettingsPage } from "./CampaignSettingsPage";

interface Props {
  params: Promise<{ campaign: string }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      gameSystem: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Serialize for client component
  const serializedEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    timezone: event.timezone,
    campaignType: event.campaignType,
    startDate: event.startDate?.toISOString().split("T")[0] ?? null,
    endDate: event.endDate?.toISOString().split("T")[0] ?? null,
    earliestTime: event.earliestTime,
    latestTime: event.latestTime,
    sessionLengthMinutes: event.sessionLengthMinutes,
    meetingType: event.meetingType,
    meetingLocation: event.meetingLocation,
    meetingRoom: event.meetingRoom,
    campaignImageBase64: event.campaignImageBase64,
    customPreSessionInstructions: event.customPreSessionInstructions,
    playerPrepUrls: event.playerPrepUrls as { label: string; url: string }[] | null,
    minPlayers: event.minPlayers,
    maxPlayers: event.maxPlayers,
    gameSystem: event.gameSystem
      ? {
          id: event.gameSystem.id,
          name: event.gameSystem.name,
          description: event.gameSystem.description,
          imageBase64: event.gameSystem.imageBase64,
          defaultInstructions: event.gameSystem.defaultInstructions,
          defaultUrls: event.gameSystem.defaultUrls as { label: string; url: string }[] | null,
          isBuiltIn: event.gameSystem.isBuiltIn,
          createdAt: event.gameSystem.createdAt.toISOString(),
        }
      : null,
  };

  return <CampaignSettingsPage event={serializedEvent} />;
}
