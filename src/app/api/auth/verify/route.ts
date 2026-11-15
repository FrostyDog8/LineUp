import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findOrCreateUserByPhone,
  isAuthDevBypassEnabled,
  issueSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { formatDbError } from "@/lib/db";

const bodySchema = z.object({
  phone: z.string().min(8).max(32),
  code: z.string().min(4).max(12),
});

/**
 * Verify OTP / magic-link code.
 * While Twilio is unwired, AUTH_DEV_BYPASS (or development) accepts any code
 * and creates a real session cookie against the sessions table.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      {
        error:
          "Enter a valid phone for the selected country (e.g. Israel 0500000000 → +972500000000).",
      },
      { status: 400 },
    );
  }

  if (!isAuthDevBypassEnabled()) {
    return NextResponse.json(
      {
        error:
          "OTP verification is not wired yet. Enable AUTH_DEV_BYPASS=true for local testing.",
      },
      { status: 501 },
    );
  }

  try {
    const user = await findOrCreateUserByPhone(phone);
    const { token, expiresAt } = await issueSession(user.id);
    const response = NextResponse.json({
      ok: true,
      stubbed: true,
      phone: user.phone,
    });
    response.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(expiresAt),
    );
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error: formatDbError(err),
      },
      { status: 500 },
    );
  }
}
