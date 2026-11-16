import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { generateInviteSlug } from "@/lib/invite";
import { assertFutureStart, nextWeeklyStarts, parseWeeklyTime } from "@/lib/datetime";
import {
  parseScheduleDefaults,
  stringifyScheduleDefaults,
} from "@/lib/schedule-defaults";
import { requireDb } from "@/lib/db";
import {
  activities,
  DEFAULT_SCHEDULE_DEFAULTS,
  managerPermissions,
  memberships,
  occurrences,
  ranks,
  type ScheduleDefaultsJson,
} from "@/lib/db/schema";
import { getActivityAccess } from "./permissions";

const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const DEFAULT_RANK_NAME = "member";
const WEEKLY_WINDOW = 5;

export type ScheduleMode = "one_time" | "weekly" | "custom";

export type ActivitySummary = {
  id: string;
  name: string;
  typeText: string;
  role: "owner" | "manager" | "participant";
  timezone: string;
  joinMode: "must_approve" | "open";
  scheduleMode: ScheduleMode;
  status: "requested" | "active" | "left" | "removed";
};

export type CreateActivityInput = {
  name: string;
  defaultCapacity: number;
  joinMode: "must_approve" | "open";
  scheduleMode: ScheduleMode;
  /** Required when scheduleMode is one_time. */
  startsAt?: Date;
  /** Required when scheduleMode is weekly. 0=Sun … 6=Sat. */
  weeklyWeekday?: number;
  /** Required when scheduleMode is weekly. `HH:mm`. */
  weeklyTime?: string;
  defaultPlace?: string | null;
  scheduleDefaults?: Partial<ScheduleDefaultsJson>;
  /** Server default Asia/Jerusalem when omitted. */
  timezone?: string;
  typeText?: string;
  defaultRankName?: string;
};

export type ActivityDetail = {
  id: string;
  name: string;
  typeText: string;
  timezone: string;
  joinMode: "must_approve" | "open";
  defaultCapacity: number;
  defaultRankId: string | null;
  inviteSlug: string;
  ownerUserId: string;
  proxyConfirmScope: "off" | "managers" | "members" | "both";
  scheduleMode: ScheduleMode;
  weeklyWeekday: number | null;
  weeklyTime: string | null;
  defaultPlace: string | null;
  scheduleDefaults: ScheduleDefaultsJson;
};

function mapActivityRow(row: typeof activities.$inferSelect): ActivityDetail {
  return {
    id: row.id,
    name: row.name,
    typeText: row.typeText,
    timezone: row.timezone,
    joinMode: row.joinMode,
    defaultCapacity: row.defaultCapacity,
    defaultRankId: row.defaultRankId,
    inviteSlug: row.inviteSlug,
    ownerUserId: row.ownerUserId,
    proxyConfirmScope: row.proxyConfirmScope,
    scheduleMode: row.scheduleMode,
    weeklyWeekday: row.weeklyWeekday,
    weeklyTime: row.weeklyTime,
    defaultPlace: row.defaultPlace,
    scheduleDefaults: parseScheduleDefaults(row.scheduleDefaultsJson),
  };
}

export async function listMyActivities(
  userId: string,
): Promise<ActivitySummary[]> {
  const db = requireDb();
  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      typeText: activities.typeText,
      role: memberships.role,
      timezone: activities.timezone,
      joinMode: activities.joinMode,
      scheduleMode: activities.scheduleMode,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(activities, eq(memberships.activityId, activities.id))
    .where(
      and(
        eq(memberships.userId, userId),
        inArray(memberships.status, ["active", "requested"]),
      ),
    )
    .orderBy(desc(activities.updatedAt));

  return rows;
}

export async function getActivityById(
  activityId: string,
): Promise<ActivityDetail | null> {
  const db = requireDb();
  const row = await db.query.activities.findFirst({
    where: eq(activities.id, activityId),
  });
  if (!row) return null;
  return mapActivityRow(row);
}

export async function getActivityByInviteSlug(
  slug: string,
): Promise<ActivityDetail | null> {
  const db = requireDb();
  const row = await db.query.activities.findFirst({
    where: eq(activities.inviteSlug, slug),
  });
  if (!row) return null;
  return getActivityById(row.id);
}

function resolveScheduleDefaults(
  partial?: Partial<ScheduleDefaultsJson>,
): ScheduleDefaultsJson {
  const weekday =
    typeof partial?.registrationOpensWeekday === "number" &&
    partial.registrationOpensWeekday >= 0 &&
    partial.registrationOpensWeekday <= 6
      ? partial.registrationOpensWeekday
      : null;
  let time: string | null = null;
  if (
    typeof partial?.registrationOpensTime === "string" &&
    partial.registrationOpensTime.trim()
  ) {
    parseWeeklyTime(partial.registrationOpensTime);
    time = partial.registrationOpensTime.trim();
  }
  let registrationOpensAt: string | null = null;
  if (
    typeof partial?.registrationOpensAt === "string" &&
    partial.registrationOpensAt.trim()
  ) {
    const d = new Date(partial.registrationOpensAt);
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid registration open time");
    }
    registrationOpensAt = d.toISOString();
  }
  return {
    registrationOpensHoursBefore:
      typeof partial?.registrationOpensHoursBefore === "number" &&
      partial.registrationOpensHoursBefore >= 0
        ? partial.registrationOpensHoursBefore
        : DEFAULT_SCHEDULE_DEFAULTS.registrationOpensHoursBefore,
    registrationOpensAt,
    registrationOpensWeekday: weekday,
    registrationOpensTime: time,
    registrationOpensMode:
      partial?.registrationOpensMode === "manual" ? "manual" : "scheduled",
    defaultRankMergeHoursBefore:
      typeof partial?.defaultRankMergeHoursBefore === "number" &&
      partial.defaultRankMergeHoursBefore >= 0
        ? partial.defaultRankMergeHoursBefore
        : DEFAULT_SCHEDULE_DEFAULTS.defaultRankMergeHoursBefore,
    rankMergeHoursBeforeByRankId: partial?.rankMergeHoursBeforeByRankId ?? {},
  };
}

export async function createActivity(
  userId: string,
  input: CreateActivityInput,
): Promise<ActivityDetail> {
  const db = requireDb();
  const name = input.name.trim();
  if (!name) throw new Error("Activity name is required");
  if (input.defaultCapacity < 1) {
    throw new Error("Default capacity must be at least 1");
  }

  if (input.scheduleMode === "one_time" && !input.startsAt) {
    throw new Error("One-time activities need a start time");
  }
  if (input.startsAt) {
    assertFutureStart(input.startsAt);
  }

  const scheduleDefaults = resolveScheduleDefaults(input.scheduleDefaults);
  if (scheduleDefaults.registrationOpensMode !== "manual") {
    if (input.scheduleMode === "weekly") {
      if (
        scheduleDefaults.registrationOpensWeekday == null ||
        !scheduleDefaults.registrationOpensTime
      ) {
        throw new Error("Pick when registration opens (day and time)");
      }
    } else if (!scheduleDefaults.registrationOpensAt) {
      throw new Error("Pick when registration opens (date and time)");
    }
  }

  const defaultPlace = input.defaultPlace?.trim() || null;
  let weeklyWeekday: number | null = null;
  let weeklyTime: string | null = null;

  if (input.scheduleMode === "weekly") {
    if (
      input.weeklyWeekday == null ||
      input.weeklyWeekday < 0 ||
      input.weeklyWeekday > 6
    ) {
      throw new Error("Pick a day of the week");
    }
    if (!input.weeklyTime?.trim()) {
      throw new Error("Pick a weekly time");
    }
    parseWeeklyTime(input.weeklyTime);
    weeklyWeekday = input.weeklyWeekday;
    weeklyTime = input.weeklyTime.trim();
  }

  const inviteSlug = generateInviteSlug();
  const defaultRankName =
    (input.defaultRankName ?? DEFAULT_RANK_NAME).trim() || DEFAULT_RANK_NAME;
  const timezone =
    (input.timezone?.trim() || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  const typeText = (input.typeText ?? "").trim();

  const created = await db.transaction(async (tx) => {
    const [activity] = await tx
      .insert(activities)
      .values({
        name,
        typeText,
        timezone,
        scheduleMode: input.scheduleMode,
        weeklyWeekday,
        weeklyTime,
        defaultPlace,
        scheduleDefaultsJson: stringifyScheduleDefaults(scheduleDefaults),
        joinMode: input.joinMode,
        defaultCapacity: input.defaultCapacity,
        ownerUserId: userId,
        inviteSlug,
      })
      .returning();
    if (!activity) throw new Error("Failed to create activity");

    const [defaultRank] = await tx
      .insert(ranks)
      .values({
        activityId: activity.id,
        name: defaultRankName,
        sortPriority: 10,
        isDefault: true,
        mergeMode: "from_open",
      })
      .returning();
    if (!defaultRank) throw new Error("Failed to create default rank");

    await tx.insert(ranks).values({
      activityId: activity.id,
      name: "New",
      sortPriority: 100,
      isDefault: false,
      mergeMode: "manual",
    });

    await tx
      .update(activities)
      .set({ defaultRankId: defaultRank.id, updatedAt: new Date() })
      .where(eq(activities.id, activity.id));

    await tx.insert(memberships).values({
      activityId: activity.id,
      userId,
      role: "owner",
      rankId: defaultRank.id,
      status: "active",
    });

    // One-time: single future event. Weekly: next ~5 from pattern.
    // Custom: empty list — owner adds events after create.
    if (input.scheduleMode === "one_time" && input.startsAt) {
      assertFutureStart(input.startsAt);
      await tx.insert(occurrences).values({
        activityId: activity.id,
        startsAt: input.startsAt,
        capacity: null,
        place: defaultPlace,
      });
    } else if (
      input.scheduleMode === "weekly" &&
      weeklyWeekday != null &&
      weeklyTime
    ) {
      const starts = nextWeeklyStarts(
        weeklyWeekday,
        weeklyTime,
        timezone,
        WEEKLY_WINDOW,
      );
      for (const startsAt of starts) {
        assertFutureStart(startsAt);
        await tx.insert(occurrences).values({
          activityId: activity.id,
          startsAt,
          capacity: null,
          place: null,
        });
      }
    }

    return {
      ...activity,
      defaultRankId: defaultRank.id,
    };
  });

  return mapActivityRow(created);
}

export type UpdateActivitySettingsInput = {
  joinMode?: "must_approve" | "open";
  defaultCapacity?: number;
  defaultRankId?: string | null;
  name?: string;
  defaultPlace?: string | null;
  scheduleDefaults?: Partial<ScheduleDefaultsJson>;
  weeklyWeekday?: number | null;
  weeklyTime?: string | null;
};

export async function updateActivitySettings(
  activityId: string,
  actorUserId: string,
  input: UpdateActivitySettingsInput,
): Promise<ActivityDetail> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can update activity settings");
  }

  const db = requireDb();
  const existing = await getActivityById(activityId);
  if (!existing) throw new Error("Activity not found");

  const patch: Partial<typeof activities.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.joinMode) patch.joinMode = input.joinMode;
  if (input.defaultCapacity !== undefined) {
    if (input.defaultCapacity < 1) {
      throw new Error("Default capacity must be at least 1");
    }
    patch.defaultCapacity = input.defaultCapacity;
  }
  if (input.defaultRankId !== undefined) {
    if (input.defaultRankId) {
      const rank = await db.query.ranks.findFirst({
        where: and(
          eq(ranks.id, input.defaultRankId),
          eq(ranks.activityId, activityId),
        ),
      });
      if (!rank) throw new Error("Rank not found for this activity");
    }
    patch.defaultRankId = input.defaultRankId;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Activity name is required");
    patch.name = name;
  }
  if (input.defaultPlace !== undefined) {
    patch.defaultPlace = input.defaultPlace?.trim() || null;
  }
  if (input.scheduleDefaults !== undefined) {
    patch.scheduleDefaultsJson = stringifyScheduleDefaults(
      resolveScheduleDefaults({
        ...existing.scheduleDefaults,
        ...input.scheduleDefaults,
      }),
    );
  }
  if (input.weeklyWeekday !== undefined) {
    if (
      input.weeklyWeekday != null &&
      (input.weeklyWeekday < 0 || input.weeklyWeekday > 6)
    ) {
      throw new Error("Invalid weekday");
    }
    patch.weeklyWeekday = input.weeklyWeekday;
  }
  if (input.weeklyTime !== undefined) {
    if (input.weeklyTime) {
      parseWeeklyTime(input.weeklyTime);
      patch.weeklyTime = input.weeklyTime.trim();
    } else {
      patch.weeklyTime = null;
    }
  }

  await db.update(activities).set(patch).where(eq(activities.id, activityId));
  const updated = await getActivityById(activityId);
  if (!updated) throw new Error("Activity not found");
  return updated;
}

export async function deleteActivity(
  activityId: string,
  actorUserId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can delete this activity");
  }

  const db = requireDb();
  const existing = await getActivityById(activityId);
  if (!existing) throw new Error("Activity not found");

  await db.transaction(async (tx) => {
    // Clear rank FKs so cascade-deleting ranks is not blocked by memberships.
    await tx
      .update(memberships)
      .set({ rankId: null, updatedAt: new Date() })
      .where(eq(memberships.activityId, activityId));
    await tx
      .update(activities)
      .set({ defaultRankId: null, updatedAt: new Date() })
      .where(eq(activities.id, activityId));
    await tx.delete(activities).where(eq(activities.id, activityId));
  });
}

export async function transferOwnership(
  activityId: string,
  actorUserId: string,
  newOwnerUserId: string,
  outgoingOwnerRankId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.isOwner || access.status !== "active") {
    throw new Error("Only the owner can transfer ownership");
  }
  if (newOwnerUserId === actorUserId) {
    throw new Error("Pick a different member as the new owner");
  }

  const db = requireDb();
  const rank = await db.query.ranks.findFirst({
    where: and(
      eq(ranks.id, outgoingOwnerRankId),
      eq(ranks.activityId, activityId),
    ),
  });
  if (!rank) throw new Error("Rank not found for this activity");

  const newOwnerMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.activityId, activityId),
      eq(memberships.userId, newOwnerUserId),
      eq(memberships.status, "active"),
    ),
  });
  if (!newOwnerMembership) {
    throw new Error("New owner must be an active member");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(activities)
      .set({ ownerUserId: newOwnerUserId, updatedAt: new Date() })
      .where(eq(activities.id, activityId));

    await tx
      .update(memberships)
      .set({
        role: "participant",
        rankId: outgoingOwnerRankId,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, access.membershipId));

    await tx
      .delete(managerPermissions)
      .where(eq(managerPermissions.membershipId, access.membershipId));

    await tx
      .update(memberships)
      .set({ role: "owner", updatedAt: new Date() })
      .where(eq(memberships.id, newOwnerMembership.id));

    await tx
      .delete(managerPermissions)
      .where(eq(managerPermissions.membershipId, newOwnerMembership.id));

    // Demote any other accidental owners (should be none).
    await tx
      .update(memberships)
      .set({ role: "participant", updatedAt: new Date() })
      .where(
        and(
          eq(memberships.activityId, activityId),
          eq(memberships.role, "owner"),
          ne(memberships.id, newOwnerMembership.id),
        ),
      );
  });
}
