import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findOrCreateUserByPhone,
  isAuthDevBypassEnabled,
  issueSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { formatDbError } from "@/lib/db";

const bodySchema = z.object({
  phone: z.string().min(8).max(32),
});

export async function POST(request: Request) {
  if (!isAuthDevBypassEnabled()) {
    return NextResponse.json(
      { error: "Dev login is disabled. Set AUTH_DEV_BYPASS=true or use development." },
      { status: 403 },
    );
  }

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

  try {
    const row = await findOrCreateUserByPhone(phone);
    const { token, expiresAt } = await issueSession(row.id);
    const user = {
      id: row.id,
      phone: row.phone,
      displayName: row.displayName,
    };

    const response = NextResponse.json({ ok: true, user });
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
