import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy DB client so the app can boot without DATABASE_URL
 * (auth/dashboard stubs still render). Migrations require DATABASE_URL.
 *
 * Singleton on globalThis avoids exhausting Supabase pooler connections
 * under Next.js hot reload (common source of opaque "Failed query" errors).
 *
 * Pool is intentionally small (not max:1): a single wedged socket must not
 * block all auth. Timeouts + dispose-on-fatal recreate hung clients.
 */
type SqlClient = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof createDrizzle>;

const globalForDb = globalThis as unknown as {
  lineupSql?: SqlClient;
  lineupDb?: DrizzleDb;
};

/** True when the URI still contains docs/template password markers. */
function isPlaceholderUrl(url: string): boolean {
  return (
    /REPLACE_ME|YOUR[_-]?PASSWORD|\[YOUR[_-]?PASSWORD\]|\[PASSWORD\]|\[PROJECT_REF\]/i.test(
      url,
    ) ||
    url === "postgresql://" ||
    url.length < 20
  );
}

function databaseUrlConfigError(url: string | undefined): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    return "DATABASE_URL is not set. Copy .env.example to .env.local, paste the Supabase Postgres URI (Project Settings → Database), then restart `npm run dev`.";
  }
  if (
    /YOUR[_-]?PASSWORD|\[YOUR[_-]?PASSWORD\]|YOUR\.PASSWORD/i.test(trimmed)
  ) {
    return "DATABASE_URL password looks like a template (YOUR-PASSWORD / [YOUR-PASSWORD]). Replace it with your real Supabase database password in .env.local, then restart `npm run dev`.";
  }
  if (/REPLACE_ME|\[PASSWORD\]|\[PROJECT_REF\]/i.test(trimmed)) {
    return "DATABASE_URL still contains a placeholder (REPLACE_ME / [PASSWORD] / [PROJECT_REF]). Paste the real pooled Supabase URI into .env.local, then restart `npm run dev`.";
  }
  return "DATABASE_URL is not set or still a placeholder. Copy .env.example to .env.local and paste the Supabase Postgres URI (Project Settings → Database), then restart `npm run dev`.";
}

function createSql(url: string): SqlClient {
  const isSupabase = /supabase\.(co|com)/i.test(url);
  return postgres(url, {
    prepare: false, // required for Supabase transaction pooler (6543)
    max: 8,
    // Supavisor transaction mode can hang pipelined queries; keep pipeline at 1.
    max_pipeline: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Backstop when the pooler/server goes silent (default TCP can hang for minutes).
    query_timeout: 15,
    queue_timeout: 10,
    cancel_timeout: 5,
    max_lifetime: 60 * 30,
    keep_alive: 30,
    connection: {
      // Server-enforced limit while a statement is running (ms).
      statement_timeout: 15_000,
    },
    ...(isSupabase ? { ssl: "require" as const } : {}),
  });
}

function createDrizzle(sql: SqlClient) {
  return drizzle(sql, { schema });
}

/** Drop the singleton so the next requireDb() opens a fresh pool. */
export function resetDbClient(): void {
  const sql = globalForDb.lineupSql;
  globalForDb.lineupSql = undefined;
  globalForDb.lineupDb = undefined;
  if (sql) {
    void sql.end({ timeout: 2 }).catch(() => {
      // Ignore close races; next createSql() opens a new pool.
    });
  }
}

function isFatalDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code =
    "code" in err && typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : "";
  const message = err.message.toLowerCase();
  const causeMessage =
    err.cause instanceof Error ? err.cause.message.toLowerCase() : "";

  return (
    code === "CONNECTION_ENDED" ||
    code === "CONNECTION_DESTROYED" ||
    code === "CONNECT_TIMEOUT" ||
    code === "CONNECTION_CLOSED" ||
    code === "CONNECT_FAILED" ||
    (code === "QUERY_TIMEOUT" && causeMessage.includes("cancel_unanswered")) ||
    message.includes("connection_ended") ||
    message.includes("connection_destroyed") ||
    message.includes("connect_timeout") ||
    message.includes("connection terminated") ||
    message.includes("server closed the connection")
  );
}

function getOrCreateDb(): DrizzleDb | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || isPlaceholderUrl(url)) {
    return null;
  }

  if (globalForDb.lineupDb && globalForDb.lineupSql) {
    return globalForDb.lineupDb;
  }

  const sql = createSql(url);
  const drizzleDb = createDrizzle(sql);
  globalForDb.lineupSql = sql;
  globalForDb.lineupDb = drizzleDb;
  return drizzleDb;
}

/** Prefer requireDb() so a disposed pool can be recreated. */
export const db = getOrCreateDb();

export type Db = NonNullable<ReturnType<typeof getOrCreateDb>>;

export function requireDb(): Db {
  const instance = getOrCreateDb();
  if (!instance) {
    throw new Error(databaseUrlConfigError(process.env.DATABASE_URL));
  }
  return instance;
}

/**
 * Run a DB callback; on a fatal connection error, dispose the pool and retry once.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  try {
    return await fn(requireDb());
  } catch (err) {
    if (!isFatalDbError(err)) throw err;
    resetDbClient();
    return await fn(requireDb());
  }
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
  const code =
    "code" in err && typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : "";

  if (
    code === "QUERY_TIMEOUT" ||
    code === "QUEUE_TIMEOUT" ||
    code === "CONNECT_TIMEOUT" ||
    lower.includes("query_timeout") ||
    lower.includes("queue_timeout") ||
    lower.includes("connect_timeout") ||
    lower.includes("statement timeout") ||
    lower.includes("canceling statement")
  ) {
    return `Database timed out (${detail}). The connection was reset — try again. If this keeps happening, restart \`npm run dev\` and check DATABASE_URL / Supabase pooler health.`;
  }

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
