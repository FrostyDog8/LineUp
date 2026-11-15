"use server";

import { redirect } from "next/navigation";
import { isAuthDevBypassEnabled, signInWithPhoneDev, signOut } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function devLoginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!isAuthDevBypassEnabled()) {
    return { ok: false, error: "Dev login is disabled" };
  }

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim() || null;

  if (!isValidPhone(phone)) {
    return {
      ok: false,
      error:
        "Enter a valid phone for the selected country (e.g. Israel 0526257840 → +972526257840).",
    };
  }

  try {
    await signInWithPhoneDev(phone, displayName);
  } catch (err) {
    const { formatDbError } = await import("@/lib/db");
    return {
      ok: false,
      error: formatDbError(err),
    };
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
