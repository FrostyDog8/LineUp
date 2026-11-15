"use client";

/**
 * Client helpers for auth UI.
 * Real better-auth/react client hooks can replace these once adapters are live.
 */

export type LoginStep = "phone" | "code" | "done";

export async function requestLoginChallenge(phone: string) {
  const res = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not start login");
  }
  return res.json() as Promise<{ ok: boolean; stubbed?: boolean; mode?: string }>;
}

export async function verifyLoginCode(phone: string, code: string) {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not verify code");
  }
  return res.json() as Promise<{ ok: boolean; stubbed?: boolean }>;
}
