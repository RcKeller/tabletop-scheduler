import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

interface PageProps {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ role?: string; id?: string }>;
}

/**
 * Legacy availability page - redirects to new participant routes
 */
export default async function AvailabilityPage({
  params,
  searchParams,
}: PageProps) {
  const { campaign: slug } = await params;
  const { role, id: participantId } = await searchParams;

  // GM mode redirects to /campaign/gm
  if (role === "gm") {
    redirect(`/${slug}/gm`);
  }

  // Player mode with ID redirects to /campaign/:participantId
  if (participantId) {
    redirect(`/${slug}/${participantId}`);
  }

  // No valid params - redirect to campaign page
  redirect(`/${slug}`);
}
