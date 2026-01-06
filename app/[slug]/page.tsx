import { sql } from "@vercel/postgres";
import { notFound } from "next/navigation";
import type { EventRow } from "@/lib/types";
import { EventPage } from "./EventPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const { rows } = await sql<EventRow>`
    SELECT * FROM events WHERE slug = ${slug}
  `;

  if (rows.length === 0) {
    notFound();
  }

  const row = rows[0];
  const event = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    isRecurring: row.is_recurring,
    recurrencePattern: row.recurrence_pattern,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    createdAt: row.created_at,
  };

  return <EventPage event={event} />;
}
