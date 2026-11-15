import { betterAuth } from "better-auth";
import { getAuthDelivery } from "./delivery";

/**
 * Better Auth scaffold for LineUp.
 * Full phone OTP / magic-link wiring lands after the delivery cost spike.
 * Until DATABASE_URL + BETTER_AUTH_SECRET are set, handlers stay stub-safe.
 */
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

export const authConfigured = Boolean(
  secret && secret.length >= 32 && process.env.DATABASE_URL,
);

function createAuth() {
  if (!secret || secret.length < 32) {
    throw new Error(
      "Better Auth is not configured. Set BETTER_AUTH_SECRET (≥32 chars) and DATABASE_URL.",
    );
  }
  return betterAuth({
    appName: "LineUp",
    secret,
    baseURL,
    // Phone identity + Twilio/WhatsApp adapters are custom for MVP;
    // keep email disabled as primary. Session tables use our Postgres later.
    emailAndPassword: {
      enabled: false,
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!authConfigured) {
    throw new Error(
      "Better Auth is not configured. Set BETTER_AUTH_SECRET (≥32 chars) and DATABASE_URL.",
    );
  }
  authInstance ??= createAuth();
  return authInstance;
}

export async function startLoginChallenge(phone: string) {
  const delivery = getAuthDelivery();
  const code = String(Math.floor(100000 + Math.random() * 900000));

  if (delivery.kind === "sms") {
    return delivery.sendOtp({ phone, code });
  }

  const url = `${baseURL}/verify?token=stub&phone=${encodeURIComponent(phone)}`;
  return delivery.sendMagicLink({ phone, url });
}

export type SessionUser = {
  id: string;
  phone: string;
  displayName: string | null;
};

/** M1 stub: no real session until Better Auth + DB are wired. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return null;
}
