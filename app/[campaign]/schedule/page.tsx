import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { SchedulePage } from "./SchedulePage";

interface Props {
  params: Promise<{ campaign: string }>;
}

export default async function Page({ params }: Props) {
  const { campaign: slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
  });

  if (!event) {
    notFound();
  }

  // Serialize for client component
  const serializedEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    campaignType: event.campaignType,
    startDate: event.startDate?.toISOString().split("T")[0] ?? null,
    endDate: event.endDate?.toISOString().split("T")[0] ?? null,
    earliestTime: event.earliestTime,
    latestTime: event.latestTime,
    sessionLengthMinutes: event.sessionLengthMinutes,
    meetingType: event.meetingType,
    meetingLocation: event.meetingLocation,
    meetingRoom: event.meetingRoom,
  };

  return <SchedulePage event={serializedEvent} />;
}
