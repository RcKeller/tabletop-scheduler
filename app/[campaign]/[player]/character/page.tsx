import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { CharacterEditPage } from "./CharacterEditPage";

interface Props {
  params: Promise<{ campaign: string; player: string }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug, player: playerSlug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      gameSystem: true,
      participants: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Find participant by URL-safe display name
  const participant = event.participants.find((p) => {
    const participantSlug = p.displayName.toLowerCase().replace(/\s+/g, "-");
    return participantSlug === decodeURIComponent(playerSlug);
  });

  if (!participant) {
    redirect(`/${slug}`);
  }

  // Serialize for client component
  const serializedEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    timezone: event.timezone,
    campaignImageBase64: event.campaignImageBase64,
    customPreSessionInstructions: event.customPreSessionInstructions,
    gameSystem: event.gameSystem
      ? {
          id: event.gameSystem.id,
          name: event.gameSystem.name,
          imageBase64: event.gameSystem.imageBase64,
        }
      : null,
    participants: event.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      isGm: p.isGm,
      characterName: p.characterName,
      characterClass: p.characterClass,
      characterTokenBase64: p.characterTokenBase64,
    })),
  };

  const serializedParticipant = {
    id: participant.id,
    displayName: participant.displayName,
    isGm: participant.isGm,
    characterName: participant.characterName,
    characterClass: participant.characterClass,
    characterSheetUrl: participant.characterSheetUrl,
    characterTokenBase64: participant.characterTokenBase64,
    notes: participant.notes,
  };

  return (
    <CharacterEditPage
      event={serializedEvent}
      participant={serializedParticipant}
    />
  );
}
