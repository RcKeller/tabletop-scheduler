import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";

interface Props {
  params: Promise<{ campaign: string; player: string; method?: string[] }>;
}

/**
 * Legacy player availability page - redirects to unified availability page
 */
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
    // Redirect to campaign page if participant not found
    redirect(`/${slug}`);
  }

  // Redirect to unified availability page
  redirect(`/${slug}/availability?role=player&id=${participant.id}`);
}
