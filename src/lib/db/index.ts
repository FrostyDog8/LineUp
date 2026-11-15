import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy DB client so the app can boot without DATABASE_URL
 * (auth/dashboard stubs still render). Migrations require DATABASE_URL.
 *
 * Singleton on globalThis avoids exhausting Supabase pooler connections
 * under Next.js hot reload (common source of opaque "Failed query" errors).
 */
type SqlClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  lineupSql?: SqlClient;
  lineupDb?: ReturnType<typeof createDrizzle>;
};

function isPlaceholderUrl(url: string): boolean {
  return (
    /REPLACE_ME|YOUR.PASSWORD|\[PASSWORD\]|\[PROJECT_REF\]/i.test(url) ||
    url === "postgresql://" ||
    url.length < 20
  );
}

function createSql(url: string): SqlClient {
  const isSupabase = /supabase\.(co|com)/i.test(url);
  return postgres(url, {
    prepare: false, // required for Supabase transaction pooler (6543)
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    ...(isSupabase ? { ssl: "require" as const } : {}),
  });
}

function createDrizzle(sql: SqlClient) {
  return drizzle(sql, { schema });
}

function createDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || isPlaceholderUrl(url)) {
    return null;
  }

  const sql = globalForDb.lineupSql ?? createSql(url);
  if (process.env.NODE_ENV !== "production") {
    globalForDb.lineupSql = sql;
  }

  return createDrizzle(sql);
}

export const db = globalForDb.lineupDb ?? createDb();
if (process.env.NODE_ENV !== "production" && db) {
  globalForDb.lineupDb = db;
}

export type Db = NonNullable<typeof db>;

export function requireDb(): Db {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not set or still a placeholder. Copy .env.example to .env.local and paste the Supabase Postgres URI (Project Settings → Database).",
    );
  }
  return db;
}

/** Unwrap drizzle/postgres errors into something actionable in the UI. */
export function formatDbError(err: unknown): string {
  if (!(err instanceof Error)) return "Database error";

  const cause =
    "cause" in err && err.cause instanceof Error
      ? err.cause
      : err.cause &&
          typeof err.cause === "object" &&
          "message" in err.cause &&
          typeof (err.cause as { message: unknown }).message === "string"
        ? (err.cause as { message: string })
        : null;

  const detail = cause?.message || err.message;
  const lower = detail.toLowerCase();

  if (
    lower.includes("password authentication failed") ||
    lower.includes("tenant or user not found") ||
    lower.includes("enotfound") ||
    lower.includes("connect") ||
    lower.includes("timeout") ||
    lower.includes("ssl")
  ) {
    return `Database connection failed (${detail}). Check DATABASE_URL in .env.local — use the pooled Supabase URI and URL-encode special characters in the password.`;
  }

  if (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("column")
  ) {
    return `Database schema mismatch (${detail}). Ensure migration 0000_init_lineup_domain is applied on project gehjyxyciymdwywjyfyx.`;
  }

  // Drizzle wraps driver errors as "Failed query: …"
  if (detail.startsWith("Failed query:")) {
    return `Database query failed. ${
      cause?.message ? `Cause: ${cause.message}. ` : ""
    }Confirm DATABASE_URL points at Supabase project gehjyxyciymdwywjyfyx and that the users table exists.`;
  }

  return detail;
}
