import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { CharacterEditPage } from "./CharacterEditPage";

interface Props {
  params: Promise<{ campaign: string; participantId: string }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug, participantId } = await params;

  // "gm" doesn't have a character page
  if (participantId === "gm") {
    redirect(`/${slug}/gm`);
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      participants: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Find participant by UUID
  let participant = event.participants.find((p) => p.id === participantId);

  // Also support legacy URL-safe display name format
  if (!participant) {
    participant = event.participants.find((p) => {
      const nameSlug = p.displayName.toLowerCase().replace(/\s+/g, "-");
      return nameSlug === decodeURIComponent(participantId);
    });
  }

  if (!participant) {
    redirect(`/${slug}`);
  }

  // GMs don't have character pages
  if (participant.isGm) {
    redirect(`/${slug}/gm`);
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
