"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { parseInviteInput } from "@/lib/invite";
import {
  createActivity,
  transferOwnership,
  updateActivitySettings,
} from "@/server/activities";
import {
  approveJoinRequest,
  assignMemberRank,
  joinActivityBySlug,
  rejectJoinRequest,
  setManagerRole,
  updateManagerToggles,
} from "@/server/memberships";
import {
  createRank,
  deleteRank,
  setDefaultRank,
  updateRank,
} from "@/server/ranks";
import type { ManagerToggles } from "@/server/permissions";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function boolFromForm(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function rethrowNavigation(err: unknown): void {
  if (
    err &&
    typeof err === "object" &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    ((err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (err as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  ) {
    throw err;
  }
}

export async function createActivityAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const name = String(formData.get("name") ?? "");
  const typeText = String(formData.get("typeText") ?? "");
  const timezone = String(formData.get("timezone") ?? "UTC");
  const joinModeRaw = String(formData.get("joinMode") ?? "must_approve");
  const joinMode =
    joinModeRaw === "open" ? "open" : ("must_approve" as const);
  const defaultCapacity = Number(formData.get("defaultCapacity") ?? 18);
  const defaultRankName = String(formData.get("defaultRankName") ?? "Regular");

  try {
    const activity = await createActivity(user.id, {
      name,
      typeText,
      timezone,
      joinMode,
      defaultCapacity: Number.isFinite(defaultCapacity) ? defaultCapacity : 18,
      defaultRankName,
    });
    revalidatePath("/dashboard");
    redirect(`/activities/${activity.id}`);
  } catch (err) {
    rethrowNavigation(err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create activity",
    };
  }
}

export async function joinActivityAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const slug = parseInviteInput(String(formData.get("invite") ?? ""));
  if (!slug) return { ok: false, error: "Enter an invite link or code" };

  try {
    const { activityId, result } = await joinActivityBySlug(user.id, slug);
    revalidatePath("/dashboard");
    revalidatePath(`/activities/${activityId}`);
    if (result.outcome === "joined" || result.outcome === "already_member") {
      redirect(`/activities/${activityId}`);
    }
    return {
      ok: true,
      message: "Join request submitted — waiting for approval.",
    };
  } catch (err) {
    rethrowNavigation(err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not join",
    };
  }
}

export async function updateSettingsAction(
  activityId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const joinModeRaw = String(formData.get("joinMode") ?? "");
  const joinMode =
    joinModeRaw === "open"
      ? ("open" as const)
      : joinModeRaw === "must_approve"
        ? ("must_approve" as const)
        : undefined;
  const defaultCapacity = Number(formData.get("defaultCapacity"));
  const defaultRankId = String(formData.get("defaultRankId") ?? "") || null;
  const name = String(formData.get("name") ?? "");
  const typeText = String(formData.get("typeText") ?? "");
  const timezone = String(formData.get("timezone") ?? "");

  try {
    await updateActivitySettings(activityId, user.id, {
      joinMode,
      defaultCapacity: Number.isFinite(defaultCapacity)
        ? defaultCapacity
        : undefined,
      defaultRankId,
      name: name || undefined,
      typeText,
      timezone: timezone || undefined,
    });
    if (defaultRankId) {
      await setDefaultRank(activityId, user.id, defaultRankId);
    }
    revalidatePath(`/activities/${activityId}`);
    revalidatePath(`/activities/${activityId}/settings`);
    return { ok: true, message: "Settings saved." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save settings",
    };
  }
}

export async function transferOwnershipAction(
  activityId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const newOwnerUserId = String(formData.get("newOwnerUserId") ?? "");
  const outgoingOwnerRankId = String(formData.get("outgoingOwnerRankId") ?? "");
  if (!newOwnerUserId || !outgoingOwnerRankId) {
    return { ok: false, error: "Pick a new owner and your new rank" };
  }

  try {
    await transferOwnership(
      activityId,
      user.id,
      newOwnerUserId,
      outgoingOwnerRankId,
    );
    revalidatePath(`/activities/${activityId}`);
    revalidatePath(`/activities/${activityId}/settings`);
    revalidatePath("/dashboard");
    return { ok: true, message: "Ownership transferred." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transfer failed",
    };
  }
}

export async function approveJoinAction(
  activityId: string,
  membershipId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSessionUser();
  const rankId = String(formData.get("rankId") ?? "");
  if (!rankId) throw new Error("Pick a rank");

  await approveJoinRequest(activityId, user.id, membershipId, rankId);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/settings`);
}

export async function rejectJoinAction(
  activityId: string,
  membershipId: string,
  _formData?: FormData,
): Promise<void> {
  void _formData;
  const user = await requireSessionUser();
  await rejectJoinRequest(activityId, user.id, membershipId);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/settings`);
}

export async function assignRankAction(
  activityId: string,
  membershipId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSessionUser();
  const rankId = String(formData.get("rankId") ?? "");
  if (!rankId) throw new Error("Pick a rank");

  await assignMemberRank(activityId, user.id, membershipId, rankId);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/settings`);
}

export async function promoteManagerAction(
  activityId: string,
  membershipId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSessionUser();
  const enabled = String(formData.get("enabled") ?? "true") !== "false";
  const toggles: ManagerToggles = {
    approveJoins: boolFromForm(formData, "approveJoins"),
    changeRanks: boolFromForm(formData, "changeRanks"),
    editLists: boolFromForm(formData, "editLists"),
    proxyConfirm: boolFromForm(formData, "proxyConfirm"),
    addGuests: boolFromForm(formData, "addGuests"),
  };

  await setManagerRole(activityId, user.id, membershipId, enabled, toggles);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/settings`);
}

export async function saveManagerTogglesAction(
  activityId: string,
  membershipId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSessionUser();
  const toggles: ManagerToggles = {
    approveJoins: boolFromForm(formData, "approveJoins"),
    changeRanks: boolFromForm(formData, "changeRanks"),
    editLists: boolFromForm(formData, "editLists"),
    proxyConfirm: boolFromForm(formData, "proxyConfirm"),
    addGuests: boolFromForm(formData, "addGuests"),
  };

  await updateManagerToggles(activityId, user.id, membershipId, toggles);
  revalidatePath(`/activities/${activityId}/settings`);
}

export async function createRankAction(
  activityId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const name = String(formData.get("name") ?? "");
  const sortPriority = Number(formData.get("sortPriority") ?? 100);

  try {
    await createRank(activityId, user.id, {
      name,
      sortPriority: Number.isFinite(sortPriority) ? sortPriority : 100,
    });
    revalidatePath(`/activities/${activityId}/settings`);
    return { ok: true, message: "Rank created." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create rank",
    };
  }
}

export async function updateRankAction(
  activityId: string,
  rankId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSessionUser();
  const name = String(formData.get("name") ?? "");
  const sortPriority = Number(formData.get("sortPriority") ?? 100);

  await updateRank(activityId, user.id, rankId, {
    name,
    sortPriority: Number.isFinite(sortPriority) ? sortPriority : undefined,
  });
  revalidatePath(`/activities/${activityId}/settings`);
}

export async function deleteRankAction(
  activityId: string,
  rankId: string,
  _formData?: FormData,
): Promise<void> {
  void _formData;
  const user = await requireSessionUser();
  await deleteRank(activityId, user.id, rankId);
  revalidatePath(`/activities/${activityId}/settings`);
}
