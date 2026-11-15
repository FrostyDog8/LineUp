import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { generateInviteSlug } from "@/lib/invite";
import { requireDb } from "@/lib/db";
import {
  activities,
  managerPermissions,
  memberships,
  ranks,
} from "@/lib/db/schema";
import { getActivityAccess } from "./permissions";

export type ActivitySummary = {
  id: string;
  name: string;
  typeText: string;
  role: "owner" | "manager" | "participant";
  timezone: string;
  joinMode: "must_approve" | "open";
  status: "requested" | "active" | "left" | "removed";
};

export type CreateActivityInput = {
  name: string;
  typeText: string;
  timezone: string;
  defaultCapacity: number;
  joinMode: "must_approve" | "open";
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
  scheduleMode: "one_time" | "recurring_simple";
};

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
  };
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

  const inviteSlug = generateInviteSlug();
  const defaultRankName = (input.defaultRankName ?? "Regular").trim() || "Regular";

  const created = await db.transaction(async (tx) => {
    const [activity] = await tx
      .insert(activities)
      .values({
        name,
        typeText: input.typeText.trim(),
        timezone: input.timezone.trim() || "UTC",
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
      })
      .returning();
    if (!defaultRank) throw new Error("Failed to create default rank");

    await tx.insert(ranks).values({
      activityId: activity.id,
      name: "New",
      sortPriority: 100,
      isDefault: false,
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

    return {
      ...activity,
      defaultRankId: defaultRank.id,
    };
  });

  return {
    id: created.id,
    name: created.name,
    typeText: created.typeText,
    timezone: created.timezone,
    joinMode: created.joinMode,
    defaultCapacity: created.defaultCapacity,
    defaultRankId: created.defaultRankId,
    inviteSlug: created.inviteSlug,
    ownerUserId: created.ownerUserId,
    proxyConfirmScope: created.proxyConfirmScope,
    scheduleMode: created.scheduleMode,
  };
}

export type UpdateActivitySettingsInput = {
  joinMode?: "must_approve" | "open";
  defaultCapacity?: number;
  defaultRankId?: string | null;
  name?: string;
  typeText?: string;
  timezone?: string;
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
  if (input.typeText !== undefined) patch.typeText = input.typeText.trim();
  if (input.timezone !== undefined) {
    patch.timezone = input.timezone.trim() || "UTC";
  }

  await db.update(activities).set(patch).where(eq(activities.id, activityId));
  const updated = await getActivityById(activityId);
  if (!updated) throw new Error("Activity not found");
  return updated;
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
