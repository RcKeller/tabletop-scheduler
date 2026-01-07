import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { GameSystemPage } from "./GameSystemPage";

interface Props {
  params: Promise<{ campaign: string; systemId: string }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug, systemId } = await params;

  // Verify campaign exists and get it for context
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      gameSystemId: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Fetch the game system
  const gameSystem = await prisma.gameSystem.findUnique({
    where: { id: systemId },
  });

  if (!gameSystem) {
    notFound();
  }

  // Serialize for client component
  const serializedSystem = {
    id: gameSystem.id,
    name: gameSystem.name,
    description: gameSystem.description,
    imageBase64: gameSystem.imageBase64,
    defaultInstructions: gameSystem.defaultInstructions,
    defaultUrls: gameSystem.defaultUrls as { label: string; url: string }[] | null,
    isBuiltIn: gameSystem.isBuiltIn,
    createdAt: gameSystem.createdAt.toISOString(),
  };

  const campaignContext = {
    slug: event.slug,
    title: event.title,
    isCurrentSystem: event.gameSystemId === systemId,
  };

  return <GameSystemPage gameSystem={serializedSystem} campaign={campaignContext} />;
}
