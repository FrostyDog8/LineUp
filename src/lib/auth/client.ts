"use client";

/**
 * Client helpers for auth UI.
 * Real better-auth/react client hooks can replace these once adapters are live.
 */

export type LoginStep = "phone" | "code" | "done";

export async function fetchAuthConfig() {
  const res = await fetch("/api/auth/config");
  if (!res.ok) return { devBypass: false };
  return res.json() as Promise<{ devBypass: boolean }>;
}

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

export async function requestDevLogin(phone: string, displayName?: string) {
  const res = await fetch("/api/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, displayName: displayName || null }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Dev login failed");
  }
  return res.json() as Promise<{ ok: boolean }>;
}
