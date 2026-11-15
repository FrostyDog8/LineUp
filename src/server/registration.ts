import { and, eq, ne } from "drizzle-orm";
import { previousWeeklyInstant } from "@/lib/datetime";
import { requireDb } from "@/lib/db";
import {
  memberships,
  occurrenceRankMerges,
  occurrences,
  ranks,
  registrationAudits,
  registrationEntries,
  users,
  type ScheduleDefaultsJson,
} from "@/lib/db/schema";
import { getActivityById } from "./activities";
import { getOccurrence } from "./occurrences";
import { getActivityAccess } from "./permissions";
import { listRanks, type RankMergeMode, type RankRow } from "./ranks";
import {
  applyRankMerge,
  compareRankThenTime,
  countMainOccupancy,
  decidePlacement,
  explainStatus,
  promoteNextWaiter,
  rebalanceMainCapacity,
  withLinePositions,
  type EngineEntry,
} from "./registration-engine";

export type RegistrationListEntry = {
  id: string;
  kind: "member" | "guest";
  userId: string | null;
  displayName: string;
  guestName: string | null;
  rankId: string | null;
  rankName: string | null;
  rankSortPriority: number;
  line: "main" | "wait";
  status: "registered" | "waitlisted" | "confirmed" | "cut" | "cancelled";
  position: number | null;
  registeredAt: Date;
  isYou: boolean;
};

export type OccurrenceRegistrationView = {
  occurrenceId: string;
  activityId: string;
  startsAt: Date;
  status: "scheduled" | "registration_open" | "closed" | "cancelled";
  effectiveCapacity: number;
  capacityOverride: number | null;
  place: string | null;
  subHeadline: string | null;
  main: RegistrationListEntry[];
  wait: RegistrationListEntry[];
  yourEntry: RegistrationListEntry | null;
  yourExplanation: string | null;
  canRegister: boolean;
  canCancel: boolean;
  canEditCapacity: boolean;
  canMergeRanks: boolean;
  canOpenRegistration: boolean;
  pendingMerges: Array<{
    rankId: string;
    rankName: string;
    mergeMode: RankMergeMode;
    mergeAt: Date | null;
    due: boolean;
  }>;
  registrationOpensAt: Date | null;
};

function toEngineEntry(row: {
  id: string;
  userId: string | null;
  rankId: string | null;
  rankSortPriority: number | null;
  line: "main" | "wait";
  status: EngineEntry["status"];
  registeredAt: Date;
  position: number | null;
  countsTowardCapacity: boolean;
}): EngineEntry {
  return {
    id: row.id,
    userId: row.userId,
    rankId: row.rankId,
    rankSortPriority: row.rankSortPriority ?? 999,
    line: row.line,
    status: row.status,
    registeredAt: row.registeredAt,
    position: row.position,
    countsTowardCapacity: row.countsTowardCapacity,
  };
}

export function resolveRankMergeAt(
  rank: RankRow,
  occurrenceStartsAt: Date,
  timezone: string,
): Date | null {
  if (rank.mergeMode !== "scheduled") return null;
  if (rank.mergeWeekday != null && rank.mergeTime) {
    return previousWeeklyInstant(
      rank.mergeWeekday,
      rank.mergeTime,
      timezone,
      occurrenceStartsAt,
    );
  }
  if (rank.mergeAt) return rank.mergeAt;
  return null;
}

export function resolveRegistrationOpensAt(
  defaults: ScheduleDefaultsJson,
  occurrenceStartsAt: Date,
  timezone: string,
  scheduleMode: "one_time" | "weekly" | "custom",
): Date | null {
  if (defaults.registrationOpensMode === "manual") return null;
  if (scheduleMode === "weekly") {
    if (
      defaults.registrationOpensWeekday == null ||
      !defaults.registrationOpensTime
    ) {
      return null;
    }
    return previousWeeklyInstant(
      defaults.registrationOpensWeekday,
      defaults.registrationOpensTime,
      timezone,
      occurrenceStartsAt,
    );
  }
  if (defaults.registrationOpensAt) {
    const d = new Date(defaults.registrationOpensAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function writeAudit(
  occurrenceId: string,
  actorUserId: string | null,
  action: string,
  detail: Record<string, unknown>,
  entryId?: string | null,
): Promise<void> {
  const db = requireDb();
  await db.insert(registrationAudits).values({
    occurrenceId,
    entryId: entryId ?? null,
    actorUserId,
    action,
    detailJson: JSON.stringify(detail),
  });
}

async function loadMergedRankIds(occurrenceId: string): Promise<Set<string>> {
  const db = requireDb();
  const rows = await db
    .select({ rankId: occurrenceRankMerges.rankId })
    .from(occurrenceRankMerges)
    .where(eq(occurrenceRankMerges.occurrenceId, occurrenceId));
  return new Set(rows.map((r) => r.rankId));
}

async function recordRankMerge(
  occurrenceId: string,
  rankId: string,
  mergedAt: Date,
  source: "from_open" | "schedule" | "manual",
): Promise<boolean> {
  const db = requireDb();
  const existing = await db.query.occurrenceRankMerges.findFirst({
    where: and(
      eq(occurrenceRankMerges.occurrenceId, occurrenceId),
      eq(occurrenceRankMerges.rankId, rankId),
    ),
  });
  if (existing) return false;
  await db.insert(occurrenceRankMerges).values({
    occurrenceId,
    rankId,
    mergedAt,
    source,
  });
  return true;
}

async function loadActiveEngineEntries(
  activityId: string,
  occurrenceId: string,
): Promise<EngineEntry[]> {
  const db = requireDb();
  const rows = await db
    .select({
      id: registrationEntries.id,
      userId: registrationEntries.userId,
      rankId: memberships.rankId,
      rankSortPriority: ranks.sortPriority,
      line: registrationEntries.line,
      status: registrationEntries.status,
      registeredAt: registrationEntries.registeredAt,
      position: registrationEntries.position,
      countsTowardCapacity: registrationEntries.countsTowardCapacity,
    })
    .from(registrationEntries)
    .leftJoin(
      memberships,
      and(
        eq(memberships.userId, registrationEntries.userId),
        eq(memberships.activityId, activityId),
      ),
    )
    .leftJoin(ranks, eq(memberships.rankId, ranks.id))
    .where(
      and(
        eq(registrationEntries.occurrenceId, occurrenceId),
        ne(registrationEntries.status, "cancelled"),
      ),
    );

  return rows.map((r) =>
    toEngineEntry({
      ...r,
      line: r.line,
      status: r.status,
      rankId: r.rankId ?? null,
      rankSortPriority: r.rankSortPriority ?? 999,
    }),
  );
}

async function persistEngineEntries(
  occurrenceId: string,
  entries: EngineEntry[],
): Promise<void> {
  const db = requireDb();
  for (const e of entries) {
    if (e.status === "cancelled") continue;
    await db
      .update(registrationEntries)
      .set({
        line: e.line,
        status: e.status,
        registeredAt: e.registeredAt,
        position: e.position,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(registrationEntries.id, e.id),
          eq(registrationEntries.occurrenceId, occurrenceId),
        ),
      );
  }
}

/**
 * Apply from_open / due scheduled merges for an open occurrence.
 * Returns how many ranks were newly merged.
 */
export async function applyDueMerges(
  activityId: string,
  occurrenceId: string,
  now: Date = new Date(),
): Promise<number> {
  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) return 0;
  if (occurrence.status !== "registration_open") return 0;

  const allRanks = await listRanks(activityId);
  const merged = await loadMergedRankIds(occurrenceId);
  let applied = 0;

  for (const rank of allRanks) {
    if (merged.has(rank.id)) continue;

    if (rank.mergeMode === "from_open") {
      const created = await recordRankMerge(
        occurrenceId,
        rank.id,
        now,
        "from_open",
      );
      if (created) {
        const capacity = occurrence.capacity ?? activity.defaultCapacity;
        const entries = await loadActiveEngineEntries(activityId, occurrenceId);
        const next = applyRankMerge(entries, rank.id, now, capacity);
        await persistEngineEntries(occurrenceId, next);
        await writeAudit(occurrenceId, null, "rank_merge", {
          rankId: rank.id,
          source: "from_open",
        });
        applied += 1;
        merged.add(rank.id);
      }
      continue;
    }

    if (rank.mergeMode === "scheduled") {
      const mergeAt = resolveRankMergeAt(
        rank,
        occurrence.startsAt,
        activity.timezone,
      );
      if (!mergeAt || mergeAt.getTime() > now.getTime()) continue;
      const created = await recordRankMerge(
        occurrenceId,
        rank.id,
        mergeAt,
        "schedule",
      );
      if (created) {
        const capacity = occurrence.capacity ?? activity.defaultCapacity;
        const entries = await loadActiveEngineEntries(activityId, occurrenceId);
        const next = applyRankMerge(entries, rank.id, mergeAt, capacity);
        await persistEngineEntries(occurrenceId, next);
        await writeAudit(occurrenceId, null, "rank_merge", {
          rankId: rank.id,
          source: "schedule",
          mergeAt: mergeAt.toISOString(),
        });
        applied += 1;
        merged.add(rank.id);
      }
    }
  }

  return applied;
}

/** Lazy: open registration when scheduled open time has passed. */
export async function ensureRegistrationState(
  activityId: string,
  occurrenceId: string,
  now: Date = new Date(),
): Promise<void> {
  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) return;
  if (occurrence.status === "cancelled" || occurrence.status === "closed") {
    return;
  }

  if (occurrence.status === "scheduled") {
    const opensAt = resolveRegistrationOpensAt(
      activity.scheduleDefaults,
      occurrence.startsAt,
      activity.timezone,
      activity.scheduleMode,
    );
    if (opensAt && opensAt.getTime() <= now.getTime()) {
      const db = requireDb();
      await db
        .update(occurrences)
        .set({ status: "registration_open", updatedAt: now })
        .where(
          and(
            eq(occurrences.id, occurrenceId),
            eq(occurrences.status, "scheduled"),
          ),
        );
      await writeAudit(occurrenceId, null, "registration_open", {
        source: "schedule",
        opensAt: opensAt.toISOString(),
      });
    }
  }

  const fresh = await getOccurrence(activityId, occurrenceId);
  if (fresh?.status === "registration_open") {
    await applyDueMerges(activityId, occurrenceId, now);
  }
}

export async function mergeRankNow(
  activityId: string,
  actorUserId: string,
  occurrenceId: string,
  rankId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canEditEvents) {
    throw new Error("You cannot merge ranks for this activity");
  }

  await ensureRegistrationState(activityId, occurrenceId);

  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) throw new Error("Event not found");
  if (occurrence.status !== "registration_open") {
    throw new Error("Open registration before merging ranks");
  }

  const rankList = await listRanks(activityId);
  const rank = rankList.find((r) => r.id === rankId);
  if (!rank) throw new Error("Rank not found");

  const merged = await loadMergedRankIds(occurrenceId);
  if (merged.has(rankId)) {
    throw new Error("This rank is already merged into main");
  }

  const now = new Date();
  const created = await recordRankMerge(occurrenceId, rankId, now, "manual");
  if (!created) throw new Error("This rank is already merged into main");

  const capacity = occurrence.capacity ?? activity.defaultCapacity;
  const entries = await loadActiveEngineEntries(activityId, occurrenceId);
  const next = applyRankMerge(entries, rankId, now, capacity);
  await persistEngineEntries(occurrenceId, next);
  await writeAudit(occurrenceId, actorUserId, "rank_merge", {
    rankId,
    source: "manual",
  });
}

export async function registerForOccurrence(
  activityId: string,
  userId: string,
  occurrenceId: string,
): Promise<{ line: "main" | "wait"; status: string; reason: string }> {
  const access = await getActivityAccess(activityId, userId);
  if (!access || access.status !== "active") {
    throw new Error("You must be an active member to register");
  }

  await ensureRegistrationState(activityId, occurrenceId);

  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) throw new Error("Event not found");
  if (occurrence.status !== "registration_open") {
    throw new Error("Registration is not open for this event");
  }
  if (occurrence.startsAt.getTime() <= Date.now()) {
    throw new Error("This event has already started");
  }

  const db = requireDb();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.activityId, activityId),
      eq(memberships.userId, userId),
      eq(memberships.status, "active"),
    ),
  });
  if (!membership?.rankId) {
    throw new Error("You need a rank before registering");
  }

  const existing = await db.query.registrationEntries.findFirst({
    where: and(
      eq(registrationEntries.occurrenceId, occurrenceId),
      eq(registrationEntries.userId, userId),
      ne(registrationEntries.status, "cancelled"),
    ),
  });
  if (existing) {
    throw new Error("You are already registered for this event");
  }

  const rankList = await listRanks(activityId);
  const rank = rankList.find((r) => r.id === membership.rankId);
  const merged = await loadMergedRankIds(occurrenceId);
  const rankMerged = merged.has(membership.rankId);
  const capacity = occurrence.capacity ?? activity.defaultCapacity;

  const engineEntries = await loadActiveEngineEntries(activityId, occurrenceId);
  const placement = decidePlacement({
    rankMerged,
    mainOccupancy: countMainOccupancy(engineEntries),
    capacity,
  });

  const now = new Date();
  const waitPeers = engineEntries.filter((e) => e.line === "wait").length;
  const mainPeers = engineEntries.filter((e) => e.line === "main").length;
  const position =
    placement.line === "main" ? mainPeers + 1 : waitPeers + 1;

  const [row] = await db
    .insert(registrationEntries)
    .values({
      occurrenceId,
      kind: "member",
      userId,
      line: placement.line,
      status: placement.status,
      registeredAt: now,
      position,
      countsTowardCapacity: true,
    })
    .returning();

  if (!row) throw new Error("Failed to register");

  await writeAudit(
    occurrenceId,
    userId,
    "register",
    {
      line: placement.line,
      status: placement.status,
      rankId: membership.rankId,
      rankName: rank?.name ?? null,
    },
    row.id,
  );

  const refreshed = await loadActiveEngineEntries(activityId, occurrenceId);
  await persistEngineEntries(
    occurrenceId,
    withLinePositions(refreshed, "rank_then_time"),
  );

  return {
    line: placement.line,
    status: placement.status,
    reason: placement.reason,
  };
}

export async function cancelRegistration(
  activityId: string,
  userId: string,
  occurrenceId: string,
): Promise<{ promoted: boolean }> {
  const access = await getActivityAccess(activityId, userId);
  if (!access || access.status !== "active") {
    throw new Error("You must be an active member to cancel");
  }

  await ensureRegistrationState(activityId, occurrenceId);

  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) throw new Error("Event not found");

  const db = requireDb();
  const existing = await db.query.registrationEntries.findFirst({
    where: and(
      eq(registrationEntries.occurrenceId, occurrenceId),
      eq(registrationEntries.userId, userId),
      ne(registrationEntries.status, "cancelled"),
    ),
  });
  if (!existing) throw new Error("You are not registered for this event");

  const wasMain =
    existing.line === "main" &&
    (existing.status === "registered" ||
      existing.status === "confirmed" ||
      existing.status === "waitlisted");

  await db
    .update(registrationEntries)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(registrationEntries.id, existing.id));

  await writeAudit(
    occurrenceId,
    userId,
    "cancel",
    { previousLine: existing.line, previousStatus: existing.status },
    existing.id,
  );

  let promoted = false;
  if (wasMain) {
    const capacity = occurrence.capacity ?? activity.defaultCapacity;
    const merged = await loadMergedRankIds(occurrenceId);
    const entries = await loadActiveEngineEntries(activityId, occurrenceId);
    const result = promoteNextWaiter(entries, capacity, merged);
    await persistEngineEntries(occurrenceId, result.entries);
    if (result.promotedId) {
      promoted = true;
      await writeAudit(
        occurrenceId,
        null,
        "auto_promote",
        { entryId: result.promotedId, reason: "cancel" },
        result.promotedId,
      );
    }
  } else {
    const entries = await loadActiveEngineEntries(activityId, occurrenceId);
    await persistEngineEntries(
      occurrenceId,
      withLinePositions(entries, "rank_then_time"),
    );
  }

  return { promoted };
}

export async function setOccurrenceCapacityLive(
  activityId: string,
  actorUserId: string,
  occurrenceId: string,
  capacity: number | null,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canEditEvents) {
    throw new Error("You cannot change capacity for this activity");
  }
  if (capacity != null && capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }

  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) throw new Error("Event not found");

  const db = requireDb();
  await db
    .update(occurrences)
    .set({ capacity, updatedAt: new Date() })
    .where(
      and(
        eq(occurrences.id, occurrenceId),
        eq(occurrences.activityId, activityId),
      ),
    );

  const effective = capacity ?? activity.defaultCapacity;
  const entries = await loadActiveEngineEntries(activityId, occurrenceId);
  let current = rebalanceMainCapacity(entries, effective, "rank_then_time");
  const merged = await loadMergedRankIds(occurrenceId);

  for (;;) {
    const before = countMainOccupancy(current);
    if (before >= effective) break;
    const result = promoteNextWaiter(current, effective, merged);
    if (!result.promotedId) break;
    current = result.entries;
    await writeAudit(
      occurrenceId,
      actorUserId,
      "auto_promote",
      { entryId: result.promotedId, reason: "capacity_increase" },
      result.promotedId,
    );
  }
  await persistEngineEntries(occurrenceId, current);

  await writeAudit(occurrenceId, actorUserId, "capacity_change", {
    capacity: effective,
    override: capacity,
  });
}

export async function getOccurrenceRegistrationView(
  activityId: string,
  occurrenceId: string,
  viewerUserId: string,
): Promise<OccurrenceRegistrationView | null> {
  await ensureRegistrationState(activityId, occurrenceId);

  const activity = await getActivityById(activityId);
  const occurrence = await getOccurrence(activityId, occurrenceId);
  if (!activity || !occurrence) return null;

  const access = await getActivityAccess(activityId, viewerUserId);
  if (!access || (access.status !== "active" && access.status !== "requested")) {
    return null;
  }

  const db = requireDb();
  const rankList = await listRanks(activityId);
  const rankById = new Map(rankList.map((r) => [r.id, r]));
  const merged = await loadMergedRankIds(occurrenceId);

  const rows = await db
    .select({
      id: registrationEntries.id,
      kind: registrationEntries.kind,
      userId: registrationEntries.userId,
      guestName: registrationEntries.guestName,
      displayName: users.displayName,
      phone: users.phone,
      rankId: memberships.rankId,
      rankName: ranks.name,
      rankSortPriority: ranks.sortPriority,
      line: registrationEntries.line,
      status: registrationEntries.status,
      position: registrationEntries.position,
      registeredAt: registrationEntries.registeredAt,
    })
    .from(registrationEntries)
    .leftJoin(users, eq(registrationEntries.userId, users.id))
    .leftJoin(
      memberships,
      and(
        eq(memberships.userId, registrationEntries.userId),
        eq(memberships.activityId, activityId),
      ),
    )
    .leftJoin(ranks, eq(memberships.rankId, ranks.id))
    .where(
      and(
        eq(registrationEntries.occurrenceId, occurrenceId),
        ne(registrationEntries.status, "cancelled"),
      ),
    );

  const mapped: RegistrationListEntry[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    userId: r.userId,
    displayName:
      r.kind === "guest"
        ? r.guestName?.trim() || "Guest"
        : r.displayName?.trim() || r.phone || "Member",
    guestName: r.guestName,
    rankId: r.rankId ?? null,
    rankName: r.rankName ?? null,
    rankSortPriority: r.rankSortPriority ?? 999,
    line: r.line,
    status: r.status,
    position: r.position,
    registeredAt: r.registeredAt,
    isYou: r.userId === viewerUserId,
  }));

  const engineSorted = [...mapped].sort((a, b) =>
    compareRankThenTime(
      {
        id: a.id,
        userId: a.userId,
        rankId: a.rankId,
        rankSortPriority: a.rankSortPriority,
        line: a.line,
        status: a.status,
        registeredAt: a.registeredAt,
        position: a.position,
        countsTowardCapacity: true,
      },
      {
        id: b.id,
        userId: b.userId,
        rankId: b.rankId,
        rankSortPriority: b.rankSortPriority,
        line: b.line,
        status: b.status,
        registeredAt: b.registeredAt,
        position: b.position,
        countsTowardCapacity: true,
      },
    ),
  );

  let mainPos = 0;
  let waitPos = 0;
  const withPos = engineSorted.map((e) => {
    if (e.line === "main") {
      mainPos += 1;
      return { ...e, position: mainPos };
    }
    waitPos += 1;
    return { ...e, position: waitPos };
  });

  const main = withPos.filter((e) => e.line === "main");
  const wait = withPos.filter((e) => e.line === "wait");
  const yourEntry = withPos.find((e) => e.isYou) ?? null;

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.activityId, activityId),
      eq(memberships.userId, viewerUserId),
      eq(memberships.status, "active"),
    ),
  });
  const yourRankId = membership?.rankId ?? null;
  const yourRankMerged = yourRankId ? merged.has(yourRankId) : false;
  const yourRank = yourRankId ? rankById.get(yourRankId) : null;

  const yourExplanation = yourEntry
    ? explainStatus({
        line: yourEntry.line,
        status: yourEntry.status,
        position: yourEntry.position,
        rankMerged: yourRankMerged,
        rankName: yourRank?.name ?? yourEntry.rankName,
      })
    : occurrence.status === "registration_open" && access.status === "active"
      ? yourRank && !yourRankMerged
        ? `You can register — ${yourRank.name} starts on the wait line until merge.`
        : "You can register for this event."
      : occurrence.status === "scheduled"
        ? "Registration is not open yet."
        : null;

  const pendingMerges = rankList
    .filter((r) => !merged.has(r.id))
    .map((r) => {
      const mergeAt = resolveRankMergeAt(
        r,
        occurrence.startsAt,
        activity.timezone,
      );
      const due =
        r.mergeMode === "scheduled" &&
        mergeAt != null &&
        mergeAt.getTime() <= Date.now();
      return {
        rankId: r.id,
        rankName: r.name,
        mergeMode: r.mergeMode,
        mergeAt,
        due,
      };
    });

  const registrationOpensAt = resolveRegistrationOpensAt(
    activity.scheduleDefaults,
    occurrence.startsAt,
    activity.timezone,
    activity.scheduleMode,
  );

  const effectiveCapacity = occurrence.capacity ?? activity.defaultCapacity;
  const canAct =
    access.status === "active" && occurrence.status === "registration_open";

  return {
    occurrenceId,
    activityId,
    startsAt: occurrence.startsAt,
    status: occurrence.status,
    effectiveCapacity,
    capacityOverride: occurrence.capacity,
    place: occurrence.place ?? activity.defaultPlace,
    subHeadline: occurrence.subHeadline,
    main,
    wait,
    yourEntry,
    yourExplanation,
    canRegister: canAct && !yourEntry,
    canCancel: canAct && Boolean(yourEntry),
    canEditCapacity: Boolean(access.canEditEvents),
    canMergeRanks: Boolean(access.canEditEvents),
    canOpenRegistration:
      Boolean(access.canEditEvents) && occurrence.status === "scheduled",
    pendingMerges,
    registrationOpensAt,
  };
}
