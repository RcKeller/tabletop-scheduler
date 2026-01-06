import { sql } from "@vercel/postgres";

export { sql };

// Helper to run queries with error handling
export async function query<T>(
  queryFn: () => Promise<{ rows: T[] }>
): Promise<T[]> {
  try {
    const result = await queryFn();
    return result.rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

// Helper for single row queries
export async function queryOne<T>(
  queryFn: () => Promise<{ rows: T[] }>
): Promise<T | null> {
  const rows = await query(queryFn);
  return rows[0] ?? null;
}
