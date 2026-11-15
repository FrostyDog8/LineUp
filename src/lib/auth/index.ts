import { betterAuth } from "better-auth";
import { redirect } from "next/navigation";
import { getAuthDelivery } from "./delivery";
import {
  createUserSession,
  destroySession,
  findOrCreateUserByPhone,
  isAuthDevBypassEnabled,
  readSessionUser,
} from "./session";

export type SessionUser = {
  id: string;
  phone: string;
  displayName: string | null;
};

export {
  createUserSession,
  destroySession,
  findOrCreateUserByPhone,
  isAuthDevBypassEnabled,
} from "./session";

/**
 * Better Auth remains available for a later Twilio/WhatsApp adapter swap.
 * M2 sessions use our `sessions` table + httpOnly cookie (see session.ts).
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

/** Read the signed-in user from the session cookie + DB. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return readSessionUser();
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Dev / bypass login: upsert user by phone and set a real session cookie. */
export async function signInWithPhoneDev(phone: string): Promise<SessionUser> {
  if (!isAuthDevBypassEnabled()) {
    throw new Error("Dev login is disabled");
  }
  const user = await findOrCreateUserByPhone(phone);
  await createUserSession(user.id);
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
  };
}

export async function signOut(): Promise<void> {
  await destroySession();
}
