import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy DB client so the app can boot without DATABASE_URL
 * (auth/dashboard stubs still render). Migrations require DATABASE_URL.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  const client = postgres(url, { prepare: false, max: 1 });
  return drizzle(client, { schema });
}

export const db = createDb();
export type Db = NonNullable<typeof db>;

export function requireDb(): Db {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add the Supabase connection string.",
    );
  }
  return db;
}
