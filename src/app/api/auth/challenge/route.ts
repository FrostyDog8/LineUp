import { z } from "zod";
import { startLoginChallenge } from "@/lib/auth";
import { getAuthDelivery } from "@/lib/auth/delivery";

const bodySchema = z.object({
  phone: z
    .string()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9\s-]+$/, "Use an E.164-style phone number"),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid phone" },
      { status: 400 },
    );
  }

  const phone = parsed.data.phone.replace(/[\s-]/g, "");
  const normalized = phone.startsWith("+") ? phone : `+${phone}`;
  const delivery = getAuthDelivery();
  const result = await startLoginChallenge(normalized);

  return Response.json({
    ok: result.ok,
    stubbed: result.stubbed ?? false,
    mode: delivery.kind,
  });
}
