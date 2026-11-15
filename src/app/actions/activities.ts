"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { parseInviteInput } from "@/lib/invite";
import { parseDateTimeLocal } from "@/lib/datetime";
import {
  createActivity,
  getActivityById,
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
  createOccurrence,
  ensureWeeklyOccurrences,
  updateOccurrence,
} from "@/server/occurrences";
import {
  createRank,
  deleteRank,
  setDefaultRank,
  updateRank,
} from "@/server/ranks";
import type { ManagerToggles } from "@/server/permissions";

const DEFAULT_TIMEZONE = "Asia/Jerusalem";

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
  const joinModeRaw = String(formData.get("joinMode") ?? "must_approve");
  const joinMode =
    joinModeRaw === "open" ? "open" : ("must_approve" as const);
  const scheduleRaw = String(formData.get("scheduleMode") ?? "custom");
  const scheduleMode =
    scheduleRaw === "weekly"
      ? ("weekly" as const)
      : scheduleRaw === "one_time"
        ? ("one_time" as const)
        : ("custom" as const);
  const defaultCapacity = Number(formData.get("defaultCapacity") ?? 18);
  const weeklyWeekdayRaw = String(formData.get("weeklyWeekday") ?? "");
  const weeklyTime = String(formData.get("weeklyTime") ?? "").trim();
  const defaultPlace = String(formData.get("defaultPlace") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const registrationOpensAtRaw = String(
    formData.get("registrationOpensAt") ?? "",
  ).trim();
  const registrationOpensWeekdayRaw = String(
    formData.get("registrationOpensWeekday") ?? "",
  );
  const registrationOpensTime = String(
    formData.get("registrationOpensTime") ?? "",
  ).trim();

  try {
    const weeklyWeekday =
      scheduleMode === "weekly" && weeklyWeekdayRaw !== ""
        ? Number(weeklyWeekdayRaw)
        : undefined;
    const startsAt =
      scheduleMode === "one_time"
        ? parseDateTimeLocal(startsAtRaw, DEFAULT_TIMEZONE)
        : undefined;
    const registrationOpensWeekday =
      scheduleMode === "weekly" && registrationOpensWeekdayRaw !== ""
        ? Number(registrationOpensWeekdayRaw)
        : undefined;
    const registrationOpensAt =
      scheduleMode !== "weekly" && registrationOpensAtRaw
        ? parseDateTimeLocal(registrationOpensAtRaw, DEFAULT_TIMEZONE).toISOString()
        : null;

    const activity = await createActivity(user.id, {
      name,
      joinMode,
      scheduleMode,
      startsAt,
      weeklyWeekday,
      weeklyTime: scheduleMode === "weekly" ? weeklyTime : undefined,
      defaultPlace: defaultPlace || null,
      scheduleDefaults: {
        registrationOpensAt,
        registrationOpensWeekday:
          scheduleMode === "weekly" ? registrationOpensWeekday : null,
        registrationOpensTime:
          scheduleMode === "weekly" ? registrationOpensTime || null : null,
        // Rank merge stays at schema default until per-rank merge UI lands.
        defaultRankMergeHoursBefore: 24,
      },
      defaultCapacity: Number.isFinite(defaultCapacity) ? defaultCapacity : 18,
      timezone: DEFAULT_TIMEZONE,
      defaultRankName: "member",
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
  const defaultPlace = String(formData.get("defaultPlace") ?? "");
  const registrationOpensAtRaw = String(
    formData.get("registrationOpensAt") ?? "",
  ).trim();
  const registrationOpensWeekdayRaw = String(
    formData.get("registrationOpensWeekday") ?? "",
  );
  const registrationOpensTime = String(
    formData.get("registrationOpensTime") ?? "",
  ).trim();
  const weeklyWeekdayRaw = String(formData.get("weeklyWeekday") ?? "");
  const weeklyTimeRaw = String(formData.get("weeklyTime") ?? "").trim();

  try {
    const existing = await getActivityById(activityId);
    if (!existing) throw new Error("Activity not found");
    const registrationOpensAt = registrationOpensAtRaw
      ? parseDateTimeLocal(
          registrationOpensAtRaw,
          existing.timezone,
        ).toISOString()
      : (existing.scheduleDefaults.registrationOpensAt ?? null);
    const scheduleDefaults = {
      registrationOpensHoursBefore:
        existing.scheduleDefaults.registrationOpensHoursBefore,
      registrationOpensAt,
      registrationOpensWeekday:
        registrationOpensWeekdayRaw !== ""
          ? Number(registrationOpensWeekdayRaw)
          : (existing.scheduleDefaults.registrationOpensWeekday ?? null),
      registrationOpensTime:
        registrationOpensTime ||
        existing.scheduleDefaults.registrationOpensTime ||
        null,
      // Preserve stored merge default; create UI no longer sets it.
      defaultRankMergeHoursBefore:
        existing.scheduleDefaults.defaultRankMergeHoursBefore ?? 24,
    };

    await updateActivitySettings(activityId, user.id, {
      joinMode,
      defaultCapacity: Number.isFinite(defaultCapacity)
        ? defaultCapacity
        : undefined,
      defaultRankId,
      name: name || undefined,
      defaultPlace,
      scheduleDefaults,
      weeklyWeekday:
        weeklyWeekdayRaw === "" ? undefined : Number(weeklyWeekdayRaw),
      weeklyTime: weeklyTimeRaw === "" ? undefined : weeklyTimeRaw,
    });
    if (defaultRankId) {
      await setDefaultRank(activityId, user.id, defaultRankId);
    }
    await ensureWeeklyOccurrences(activityId);
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

export async function createOccurrenceAction(
  activityId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const activity = await getActivityById(activityId);
  if (!activity) return { ok: false, error: "Activity not found" };

  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const placeRaw = String(formData.get("place") ?? "");
  const notes = String(formData.get("notes") ?? "");

  try {
    const startsAt = parseDateTimeLocal(startsAtRaw, activity.timezone);
    const capacity =
      capacityRaw === ""
        ? null
        : Number.isFinite(Number(capacityRaw))
          ? Number(capacityRaw)
          : null;

    await createOccurrence(activityId, user.id, {
      startsAt,
      capacity,
      place: placeRaw.trim() || null,
      notes: notes || null,
    });
    await ensureWeeklyOccurrences(activityId);
    revalidatePath(`/activities/${activityId}`);
    return { ok: true, message: "Event added." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not add event",
    };
  }
}

export async function updateOccurrenceAction(
  activityId: string,
  occurrenceId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const activity = await getActivityById(activityId);
  if (!activity) return { ok: false, error: "Activity not found" };

  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const placeRaw = String(formData.get("place") ?? "");
  const notes = String(formData.get("notes") ?? "");

  try {
    const startsAt = parseDateTimeLocal(startsAtRaw, activity.timezone);
    const capacity =
      capacityRaw === ""
        ? null
        : Number.isFinite(Number(capacityRaw))
          ? Number(capacityRaw)
          : null;

    await updateOccurrence(activityId, user.id, occurrenceId, {
      startsAt,
      capacity,
      place: placeRaw.trim() || null,
      notes: notes || null,
    });
    await ensureWeeklyOccurrences(activityId);
    revalidatePath(`/activities/${activityId}`);
    return { ok: true, message: "Event updated." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update event",
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
  _prev: ActionResult | null,
  _formData?: FormData,
): Promise<ActionResult> {
  void _formData;
  const user = await requireSessionUser();
  try {
    await deleteRank(activityId, user.id, rankId);
    revalidatePath(`/activities/${activityId}/settings`);
    return { ok: true, message: "Rank deleted." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not delete rank",
    };
  }
}
