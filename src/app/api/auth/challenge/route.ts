import { z } from "zod";
import { startLoginChallenge } from "@/lib/auth";
import { getAuthDelivery } from "@/lib/auth/delivery";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";

const bodySchema = z.object({
  phone: z.string().min(8).max(32),
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

  const normalized = normalizePhone(parsed.data.phone);
  if (!isValidPhone(normalized)) {
    return Response.json(
      {
        error:
          "Enter a valid phone for the selected country (e.g. Israel 0526257840 → +972526257840).",
      },
      { status: 400 },
    );
  }

  const delivery = getAuthDelivery();
  const result = await startLoginChallenge(normalized);

  return Response.json({
    ok: result.ok,
    stubbed: result.stubbed ?? false,
    mode: delivery.kind,
  });
}
