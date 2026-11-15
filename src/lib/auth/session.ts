import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { requireDb, withDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  phone: string;
  displayName: string | null;
};

export const SESSION_COOKIE = "lineup_session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;

export function isAuthDevBypassEnabled(): boolean {
  if (process.env.AUTH_DEV_BYPASS === "true") return true;
  return process.env.NODE_ENV === "development";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export type IssuedSession = {
  token: string;
  expiresAt: Date;
};

/** Cookie options for lineup_session (httpOnly, persistent ~30 days). */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // Both maxAge + expires so browsers keep the cookie across restarts
    // (not a session-only cookie cleared when the tab/browser closes).
    maxAge: SESSION_MAX_AGE_SEC,
    expires: expiresAt,
  };
}

export async function findOrCreateUserByPhone(
  phone: string,
  displayName?: string | null,
) {
  return withDb(async (db) => {
    const existing = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });
    if (existing) {
      if (displayName && !existing.displayName) {
        const [updated] = await db
          .update(users)
          .set({ displayName, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
          .returning();
        return updated ?? existing;
      }
      return existing;
    }
    const [created] = await db
      .insert(users)
      .values({
        phone,
        displayName: displayName?.trim() || null,
      })
      .returning();
    if (!created) throw new Error("Failed to create user");
    return created;
  });
}

/** Insert a session row and return the raw token (caller sets the cookie). */
export async function issueSession(userId: string): Promise<IssuedSession> {
  return withDb(async (db) => {
    const token = newSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(sessions).values({
      userId,
      token: tokenHash,
      expiresAt,
    });

    return { token, expiresAt };
  });
}

export async function createUserSession(userId: string): Promise<string> {
  const { token, expiresAt } = await issueSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return token;
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let db;
  try {
    db = requireDb();
  } catch {
    return null;
  }

  const tokenHash = hashToken(token);
  // Use SQL now() so prerender does not see a current-time Date read.
  const row = await db
    .select({
      id: users.id,
      phone: users.phone,
      displayName: users.displayName,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(eq(sessions.token, tokenHash), gt(sessions.expiresAt, sql`now()`)),
    )
    .limit(1);

  const session = row[0];
  if (!session) return null;

  return {
    id: session.id,
    phone: session.phone,
    displayName: session.displayName,
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await withDb(async (db) => {
        await db.delete(sessions).where(eq(sessions.token, hashToken(token)));
      });
    } catch {
      // Ignore missing DB on logout
    }
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
