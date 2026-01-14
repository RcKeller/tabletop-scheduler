import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { CampaignLayoutClient } from "./CampaignLayoutClient";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ campaign: string }>;
}

export default async function CampaignLayout({ children, params }: LayoutProps) {
  const { campaign: slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true, customPreSessionInstructions: true },
  });

  if (!event) {
    notFound();
  }

  return (
    <CampaignLayoutClient
      campaignSlug={event.slug}
      campaignTitle={event.title}
      eventId={event.id}
      hasCharacterSetup={!!event.customPreSessionInstructions}
    >
      {children}
    </CampaignLayoutClient>
  );
}
