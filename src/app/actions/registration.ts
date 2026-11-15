"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth";
import {
  cancelRegistration,
  mergeRankNow,
  registerForOccurrence,
  setOccurrenceCapacityLive,
} from "@/server/registration";
import { openRegistrationForOccurrence } from "@/server/occurrences";
import type { ActionResult } from "@/app/actions/activities";

function revalidateOccurrence(activityId: string, occurrenceId: string) {
  revalidatePath(`/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}/events/${occurrenceId}`);
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
      throw new Error("Capacity must be at least 1");
    }
    await setOccurrenceCapacityLive(
      activityId,
      user.id,
      occurrenceId,
      capacity,
    );
    revalidateOccurrence(activityId, occurrenceId);
    return { ok: true, message: "Capacity updated." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update capacity",
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
