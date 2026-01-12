import { prisma } from "@/lib/db/prisma";
import { nanoid } from "nanoid";

export async function generateSlug(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  if (!base) {
    return nanoid(8);
  }

  const existing = await prisma.event.findUnique({
    where: { slug: base },
  });

  return existing ? `${base}-${nanoid(6)}` : base;
}

