import { sql } from "@vercel/postgres";
import { nanoid } from "nanoid";

/**
 * Generate a URL-safe slug from an event title.
 * Checks for collisions and appends a random suffix if needed.
 */
export async function generateSlug(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  // Handle edge case of empty slug
  if (!base) {
    return nanoid(8);
  }

  // Check DB for collision
  const { rows } = await sql`SELECT 1 FROM events WHERE slug = ${base}`;

  if (rows.length > 0) {
    // Collision - append random suffix
    return `${base}-${nanoid(6)}`;
  }

  return base;
}

/**
 * Validate that a slug is URL-safe
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 60;
}
