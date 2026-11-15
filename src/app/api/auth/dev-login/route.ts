import { z } from "zod";
import { isAuthDevBypassEnabled, signInWithPhoneDev } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";

const bodySchema = z.object({
  phone: z.string().min(8).max(20),
  displayName: z.string().max(80).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isAuthDevBypassEnabled()) {
    return Response.json(
      { error: "Dev login is disabled. Set AUTH_DEV_BYPASS=true or use development." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) {
    return Response.json(
      { error: "Use an E.164 phone like +972501234567" },
      { status: 400 },
    );
  }

  try {
    const user = await signInWithPhoneDev(
      phone,
      parsed.data.displayName ?? null,
    );
    return Response.json({ ok: true, user });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Could not create session",
      },
      { status: 500 },
    );
  }
}
