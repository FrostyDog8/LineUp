import { randomBytes } from "node:crypto";

/** Short invite code used in join links (`/activities/join?code=…`). */
export function generateInviteSlug(): string {
  return randomBytes(6).toString("base64url").replace(/=+$/, "");
}

/** Extract invite slug from a full URL or raw code. */
export function parseInviteInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("://") || trimmed.startsWith("/")) {
      const url = trimmed.startsWith("/")
        ? new URL(trimmed, "http://local")
        : new URL(trimmed);
      const fromQuery =
        url.searchParams.get("code") ?? url.searchParams.get("invite");
      if (fromQuery) return fromQuery.trim();
      const parts = url.pathname.split("/").filter(Boolean);
      const joinIdx = parts.findIndex((p) => p === "join");
      if (joinIdx >= 0 && parts[joinIdx + 1]) return parts[joinIdx + 1]!;
      return parts[parts.length - 1] ?? trimmed;
    }
  } catch {
    // fall through — treat as raw code
  }
  return trimmed.replace(/^#+/, "");
}
