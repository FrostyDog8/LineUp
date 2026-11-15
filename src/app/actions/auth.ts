"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isAuthDevBypassEnabled,
  requireSessionUser,
  signInWithPhoneDev,
  signOut,
} from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { requireDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function devLoginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!isAuthDevBypassEnabled()) {
    return { ok: false, error: "Dev login is disabled" };
  }

  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  if (!isValidPhone(phone)) {
    return {
      ok: false,
      error:
        "Enter a valid phone for the selected country (e.g. Israel 0500000000 → +972500000000).",
    };
  }

  try {
    await signInWithPhoneDev(phone);
  } catch (err) {
    const { formatDbError } = await import("@/lib/db");
    return {
      ok: false,
      error: formatDbError(err),
    };
  }

  redirect("/dashboard");
}

export async function updateDisplayNameAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (displayName.length < 2) {
    return { ok: false, error: "Enter your full name." };
  }
  if (displayName.length > 80) {
    return { ok: false, error: "Name is too long (max 80 characters)." };
  }

  try {
    const db = requireDb();
    await db
      .update(users)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch (err) {
    const { formatDbError } = await import("@/lib/db");
    return { ok: false, error: formatDbError(err) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
