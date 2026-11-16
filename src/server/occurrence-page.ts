import type { OccurrenceLineView } from "@/components/occurrence-line";
import { getActivityById } from "@/server/activities";
import { getActivityAccess } from "@/server/permissions";
import {
  getOccurrenceRegistrationView,
  type OccurrenceRegistrationView,
} from "@/server/registration";

export type OccurrencePageData = {
  activity: NonNullable<Awaited<ReturnType<typeof getActivityById>>>;
  access: NonNullable<Awaited<ReturnType<typeof getActivityAccess>>>;
  clientView: OccurrenceLineView;
};

export type OccurrencePageLoadResult =
  | { ok: true; data: OccurrencePageData }
  | { ok: false; reason: "not_found" | "forbidden" };

function serializeEntry(e: OccurrenceRegistrationView["main"][number]) {
  return {
    ...e,
    registeredAt: e.registeredAt.toISOString(),
  };
}

export function toClientOccurrenceView(
  view: OccurrenceRegistrationView,
): OccurrenceLineView {
  return {
    occurrenceId: view.occurrenceId,
    activityId: view.activityId,
    startsAt: view.startsAt.toISOString(),
    status: view.status,
    effectiveCapacity: view.effectiveCapacity,
    capacityOverride: view.capacityOverride,
    place: view.place,
    placeOverride: view.placeOverride,
    defaultPlace: view.defaultPlace,
    subHeadline: view.subHeadline,
    main: view.main.map(serializeEntry),
    wait: view.wait.map(serializeEntry),
    yourEntry: view.yourEntry ? serializeEntry(view.yourEntry) : null,
    yourExplanation: view.yourExplanation,
    canRegister: view.canRegister,
    canCancel: view.canCancel,
    canEditSettings: view.canEditSettings,
    canMergeRanks: view.canMergeRanks,
    canOpenRegistration: view.canOpenRegistration,
    pendingMerges: view.pendingMerges.map((m) => ({
      ...m,
      mergeAt: m.mergeAt ? m.mergeAt.toISOString() : null,
    })),
    rankMergeSettings: view.rankMergeSettings.map((r) => ({
      ...r,
      mergeAt: r.mergeAt ? r.mergeAt.toISOString() : null,
      activityMergeAt: r.activityMergeAt
        ? r.activityMergeAt.toISOString()
        : null,
    })),
    registrationOpensAt: view.registrationOpensAt
      ? view.registrationOpensAt.toISOString()
      : null,
    registrationOpensOverride: view.registrationOpensOverride
      ? view.registrationOpensOverride.toISOString()
      : null,
    defaultRegistrationOpensAt: view.defaultRegistrationOpensAt
      ? view.defaultRegistrationOpensAt.toISOString()
      : null,
  };
}

export async function loadOccurrencePageData(
  activityId: string,
  occurrenceId: string,
  userId: string,
): Promise<OccurrencePageLoadResult> {
  const activity = await getActivityById(activityId);
  if (!activity) return { ok: false, reason: "not_found" };

  const access = await getActivityAccess(activityId, userId);
  if (!access || (access.status !== "active" && access.status !== "requested")) {
    return { ok: false, reason: "forbidden" };
  }

  const view = await getOccurrenceRegistrationView(
    activityId,
    occurrenceId,
    userId,
  );
  if (!view) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    data: {
      activity,
      access,
      clientView: toClientOccurrenceView(view),
    },
  };
}
