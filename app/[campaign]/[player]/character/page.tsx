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

  // Only pass what the page needs
  const serializedEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    customPreSessionInstructions: event.customPreSessionInstructions,
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

  // Pass all participants for the party display
  const allParticipants = event.participants.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    isGm: p.isGm,
    characterName: p.characterName,
    characterClass: p.characterClass,
    characterSheetUrl: p.characterSheetUrl,
    characterTokenBase64: p.characterTokenBase64,
    notes: p.notes,
  }));

  return (
    <CharacterEditPage
      event={serializedEvent}
      participant={serializedParticipant}
      allParticipants={allParticipants}
    />
  );
}
