"use client";

/**
 * Client helpers for auth UI.
 * Real better-auth/react client hooks can replace these once adapters are live.
 */

export type LoginStep = "phone" | "code" | "done";

/** Client-side ceiling so UI never stays on “Signing in…” forever. */
const AUTH_FETCH_TIMEOUT_MS = 18_000;

function authAbortSignal(): AbortSignal {
  return AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS);
}

function formatAuthFetchError(err: unknown, fallback: string): Error {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return new Error(
      "Sign-in timed out. Check your connection and try again — if it keeps hanging, restart the dev server.",
    );
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return new Error("Sign-in was cancelled.");
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

export async function fetchAuthConfig() {
  try {
    const res = await fetch("/api/auth/config", {
      credentials: "same-origin",
      signal: authAbortSignal(),
    });
    if (!res.ok) return { devBypass: false };
    return res.json() as Promise<{ devBypass: boolean }>;
  } catch {
    return { devBypass: false };
  }
}

export async function requestLoginChallenge(phone: string) {
  try {
    const res = await fetch("/api/auth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      credentials: "same-origin",
      signal: authAbortSignal(),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, "Could not start login"));
    }
    return res.json() as Promise<{ ok: boolean; stubbed?: boolean; mode?: string }>;
  } catch (err) {
    throw formatAuthFetchError(err, "Could not start login");
  }
}

export async function verifyLoginCode(phone: string, code: string) {
  try {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
      credentials: "same-origin",
      signal: authAbortSignal(),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, "Could not verify code"));
    }
    return res.json() as Promise<{ ok: boolean; stubbed?: boolean }>;
  } catch (err) {
    throw formatAuthFetchError(err, "Could not verify code");
  }
}

export async function requestDevLogin(phone: string) {
  try {
    const res = await fetch("/api/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      credentials: "same-origin",
      signal: authAbortSignal(),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, "Dev login failed"));
    }
    return res.json() as Promise<{ ok: boolean }>;
  } catch (err) {
    throw formatAuthFetchError(err, "Dev login failed");
  }
}
