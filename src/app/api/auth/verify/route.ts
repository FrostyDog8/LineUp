import { z } from "zod";

const bodySchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().min(4).max(12),
});

/**
 * Verify stub — accepts any code while OTP/magic-link adapters are unwired.
 * Replace with Better Auth / challenge table checks in M1 exit.
 */
export async function POST(request: Request) {
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

  return Response.json({
    ok: true,
    stubbed: true,
    phone: parsed.data.phone,
  });
}
