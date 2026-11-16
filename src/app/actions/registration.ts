"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth";
import { parseDateTimeLocal } from "@/lib/datetime";
import { getActivityById } from "@/server/activities";
import {
  cancelRegistration,
  mergeRankNow,
  registerForOccurrence,
  setOccurrenceCapacityLive,
  setOccurrenceEventSettings,
  setOccurrenceRankMergeOverride,
} from "@/server/registration";
import { openRegistrationForOccurrence } from "@/server/occurrences";
import type { RankMergeMode } from "@/server/ranks";
import type { ActionResult } from "@/app/actions/activities";

function revalidateOccurrence(activityId: string, occurrenceId: string) {
  const base = `/activities/${activityId}/events/${occurrenceId}`;
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(base);
  revalidatePath(`${base}/merge`);
  revalidatePath(`${base}/settings`);
}

export async function registerForOccurrenceAction(
  activityId: string,
  occurrenceId: string,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  try {
    const result = await registerForOccurrence(
      activityId,
      user.id,
      occurrenceId,
    );
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: result.reason };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not register",
    };
  }
}

export async function cancelRegistrationAction(
  activityId: string,
  occurrenceId: string,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  try {
    const result = await cancelRegistration(activityId, user.id, occurrenceId);
    revalidateOccurrence(activityId, occurrenceId);
    return {
      ok: true,
      message: result.promoted
        ? "Cancelled — next person promoted from the wait line."
        : "Registration cancelled.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not cancel",
    };
  }
}

export async function mergeRankNowAction(
  activityId: string,
  occurrenceId: string,
  rankId: string,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  try {
    await mergeRankNow(activityId, user.id, occurrenceId, rankId);
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: "Rank merged into main." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not merge rank",
    };
  }
}

export async function setOccurrenceCapacityAction(
  activityId: string,
  occurrenceId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const raw = String(formData.get("capacity") ?? "").trim();
  try {
    const capacity = raw === "" ? null : Number(raw);
    if (capacity != null && (!Number.isFinite(capacity) || capacity < 1)) {
      throw new Error("Spots must be at least 1");
    }
    await setOccurrenceCapacityLive(
      activityId,
      user.id,
      occurrenceId,
      capacity,
    );
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: "Spots updated." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update spots",
    };
  }
}

export async function setOccurrenceEventSettingsAction(
  activityId: string,
  occurrenceId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const activity = await getActivityById(activityId);
  if (!activity) return { ok: false, error: "Activity not found" };

  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const placeRaw = String(formData.get("place") ?? "");
  const subHeadlineRaw = String(formData.get("subHeadline") ?? "");
  const overrideOpen = String(formData.get("overrideRegistrationOpen") ?? "");
  const opensAtRaw = String(formData.get("registrationOpensAt") ?? "").trim();

  try {
    const capacity =
      capacityRaw === ""
        ? null
        : Number.isFinite(Number(capacityRaw))
          ? Number(capacityRaw)
          : null;
    if (capacity != null && capacity < 1) {
      throw new Error("Spots must be at least 1");
    }

    let registrationOpensAt: Date | null = null;
    if (overrideOpen === "1") {
      if (!opensAtRaw) throw new Error("Registration open time is required");
      registrationOpensAt = parseDateTimeLocal(opensAtRaw, activity.timezone);
    }

    await setOccurrenceEventSettings(activityId, user.id, occurrenceId, {
      capacity,
      place: placeRaw.trim() || null,
      subHeadline: subHeadlineRaw.trim() || null,
      registrationOpensAt,
    });
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: "Event settings saved." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save settings",
    };
  }
}

export async function setOccurrenceRankMergeOverrideAction(
  activityId: string,
  occurrenceId: string,
  rankId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  const activity = await getActivityById(activityId);
  if (!activity) return { ok: false, error: "Activity not found" };

  const useDefault = String(formData.get("useDefault") ?? "") === "1";
  const mergeModeRaw = String(formData.get("mergeMode") ?? "from_open");
  const mergeAtRaw = String(formData.get("mergeAt") ?? "").trim();

  try {
    if (useDefault) {
      await setOccurrenceRankMergeOverride(
        activityId,
        user.id,
        occurrenceId,
        rankId,
        { useDefault: true },
      );
    } else {
      const mergeMode = (
        mergeModeRaw === "scheduled" || mergeModeRaw === "manual"
          ? mergeModeRaw
          : "from_open"
      ) as RankMergeMode;
      const mergeAt =
        mergeMode === "scheduled" && mergeAtRaw
          ? parseDateTimeLocal(mergeAtRaw, activity.timezone)
          : null;
      await setOccurrenceRankMergeOverride(
        activityId,
        user.id,
        occurrenceId,
        rankId,
        { useDefault: false, mergeMode, mergeAt },
      );
    }
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: "Merge timing updated." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update merge",
    };
  }
}

export async function openRegistrationFromEventAction(
  activityId: string,
  occurrenceId: string,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  try {
    await openRegistrationForOccurrence(activityId, user.id, occurrenceId);
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: "Registration opened." };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not open registration",
    };
  }
}
