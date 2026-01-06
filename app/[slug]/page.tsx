import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { EventPage } from "./EventPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
  });

  if (!event) {
    notFound();
  }

  // Serialize for client component
  const serializedEvent = {
    ...event,
    startTime: event.startTime?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
  };

  return <EventPage event={serializedEvent} />;
}
