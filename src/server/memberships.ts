import { and, asc, eq, inArray } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import {
  activities,
  managerPermissions,
  memberships,
  ranks,
  users,
} from "@/lib/db/schema";
import type { ManagerToggles } from "./permissions";
import { getActivityAccess } from "./permissions";

export type MemberRow = {
  membershipId: string;
  userId: string;
  phone: string;
  displayName: string | null;
  role: "owner" | "manager" | "participant";
  status: "requested" | "active" | "left" | "removed";
  rankId: string | null;
  rankName: string | null;
  permissions: ManagerToggles | null;
  createdAt: Date;
};

export async function listMembers(activityId: string): Promise<MemberRow[]> {
  const db = requireDb();
  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      phone: users.phone,
      displayName: users.displayName,
      role: memberships.role,
      status: memberships.status,
      rankId: memberships.rankId,
      rankName: ranks.name,
      createdAt: memberships.createdAt,
      approveJoins: managerPermissions.approveJoins,
      changeRanks: managerPermissions.changeRanks,
      editLists: managerPermissions.editLists,
      proxyConfirm: managerPermissions.proxyConfirm,
      addGuests: managerPermissions.addGuests,
      hasPerms: managerPermissions.id,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .leftJoin(ranks, eq(memberships.rankId, ranks.id))
    .leftJoin(
      managerPermissions,
      eq(managerPermissions.membershipId, memberships.id),
    )
    .where(
      and(
        eq(memberships.activityId, activityId),
        inArray(memberships.status, ["active", "requested"]),
      ),
    )
    .orderBy(asc(memberships.createdAt));

  return rows.map((row) => ({
    membershipId: row.membershipId,
    userId: row.userId,
    phone: row.phone,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    rankId: row.rankId,
    rankName: row.rankName,
    createdAt: row.createdAt,
    permissions:
      row.role === "manager" && row.hasPerms
        ? {
            approveJoins: Boolean(row.approveJoins),
            changeRanks: Boolean(row.changeRanks),
            editLists: Boolean(row.editLists),
            proxyConfirm: Boolean(row.proxyConfirm),
            addGuests: Boolean(row.addGuests),
          }
        : null,
  }));
}

export type JoinResult =
  | { outcome: "joined"; membershipId: string }
  | { outcome: "requested"; membershipId: string }
  | { outcome: "already_member"; membershipId: string }
  | { outcome: "already_requested"; membershipId: string };

export async function joinActivityBySlug(
  userId: string,
  inviteSlug: string,
): Promise<{ activityId: string; result: JoinResult }> {
  const db = requireDb();
  const activity = await db.query.activities.findFirst({
    where: eq(activities.inviteSlug, inviteSlug),
  });
  if (!activity) throw new Error("Invite not found");

  const existing = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.activityId, activity.id),
      eq(memberships.userId, userId),
    ),
  });

  if (existing) {
    if (existing.status === "active") {
      return {
        activityId: activity.id,
        result: {
          outcome: "already_member",
          membershipId: existing.id,
        },
      };
    }
    if (existing.status === "requested") {
      return {
        activityId: activity.id,
        result: {
          outcome: "already_requested",
          membershipId: existing.id,
        },
      };
    }
    // Re-join after left/removed
    if (activity.joinMode === "open") {
      const [updated] = await db
        .update(memberships)
        .set({
          status: "active",
          role: "participant",
          rankId: activity.defaultRankId,
          updatedAt: new Date(),
        })
        .where(eq(memberships.id, existing.id))
        .returning();
      return {
        activityId: activity.id,
        result: {
          outcome: "joined",
          membershipId: updated?.id ?? existing.id,
        },
      };
    }
    const [updated] = await db
      .update(memberships)
      .set({
        status: "requested",
        role: "participant",
        rankId: null,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, existing.id))
      .returning();
    return {
      activityId: activity.id,
      result: {
        outcome: "requested",
        membershipId: updated?.id ?? existing.id,
      },
    };
  }

  if (activity.joinMode === "open") {
    const [created] = await db
      .insert(memberships)
      .values({
        activityId: activity.id,
        userId,
        role: "participant",
        rankId: activity.defaultRankId,
        status: "active",
      })
      .returning();
    if (!created) throw new Error("Failed to join activity");
    return {
      activityId: activity.id,
      result: { outcome: "joined", membershipId: created.id },
    };
  }

  const [created] = await db
    .insert(memberships)
    .values({
      activityId: activity.id,
      userId,
      role: "participant",
      status: "requested",
    })
    .returning();
  if (!created) throw new Error("Failed to request join");
  return {
    activityId: activity.id,
    result: { outcome: "requested", membershipId: created.id },
  };
}

export async function approveJoinRequest(
  activityId: string,
  actorUserId: string,
  membershipId: string,
  rankId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canApproveJoins) {
    throw new Error("Not allowed to approve joins");
  }

  const db = requireDb();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.id, membershipId),
      eq(memberships.activityId, activityId),
      eq(memberships.status, "requested"),
    ),
  });
  if (!membership) throw new Error("Join request not found");

  const rank = await db.query.ranks.findFirst({
    where: and(eq(ranks.id, rankId), eq(ranks.activityId, activityId)),
  });
  if (!rank) throw new Error("Rank not found");

  await db
    .update(memberships)
    .set({
      status: "active",
      role: "participant",
      rankId,
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membershipId));
}

export async function rejectJoinRequest(
  activityId: string,
  actorUserId: string,
  membershipId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canApproveJoins) {
    throw new Error("Not allowed to reject joins");
  }

  const db = requireDb();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.id, membershipId),
      eq(memberships.activityId, activityId),
      eq(memberships.status, "requested"),
    ),
  });
  if (!membership) throw new Error("Join request not found");

  await db
    .update(memberships)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(memberships.id, membershipId));
}

export async function assignMemberRank(
  activityId: string,
  actorUserId: string,
  membershipId: string,
  rankId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canChangeRanks) {
    throw new Error("Not allowed to change ranks");
  }

  const db = requireDb();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.id, membershipId),
      eq(memberships.activityId, activityId),
      eq(memberships.status, "active"),
    ),
  });
  if (!membership) throw new Error("Member not found");

  const rank = await db.query.ranks.findFirst({
    where: and(eq(ranks.id, rankId), eq(ranks.activityId, activityId)),
  });
  if (!rank) throw new Error("Rank not found");

  await db
    .update(memberships)
    .set({ rankId, updatedAt: new Date() })
    .where(eq(memberships.id, membershipId));
}

export async function setManagerRole(
  activityId: string,
  actorUserId: string,
  membershipId: string,
  enabled: boolean,
  toggles?: Partial<ManagerToggles>,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canPromoteManagers) {
    throw new Error("Only the owner can manage managers");
  }

  const db = requireDb();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.id, membershipId),
      eq(memberships.activityId, activityId),
      eq(memberships.status, "active"),
    ),
  });
  if (!membership) throw new Error("Member not found");
  if (membership.role === "owner") {
    throw new Error("Cannot change the owner's manager status");
  }

  if (!enabled) {
    await db.transaction(async (tx) => {
      await tx
        .update(memberships)
        .set({ role: "participant", updatedAt: new Date() })
        .where(eq(memberships.id, membershipId));
      await tx
        .delete(managerPermissions)
        .where(eq(managerPermissions.membershipId, membershipId));
    });
    return;
  }

  const next: ManagerToggles = {
    approveJoins: toggles?.approveJoins ?? true,
    changeRanks: toggles?.changeRanks ?? true,
    editLists: toggles?.editLists ?? false,
    proxyConfirm: toggles?.proxyConfirm ?? false,
    addGuests: toggles?.addGuests ?? false,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ role: "manager", updatedAt: new Date() })
      .where(eq(memberships.id, membershipId));

    const existing = await tx.query.managerPermissions.findFirst({
      where: eq(managerPermissions.membershipId, membershipId),
    });
    if (existing) {
      await tx
        .update(managerPermissions)
        .set({ ...next, updatedAt: new Date() })
        .where(eq(managerPermissions.membershipId, membershipId));
    } else {
      await tx.insert(managerPermissions).values({
        membershipId,
        ...next,
      });
    }
  });
}

export async function updateManagerToggles(
  activityId: string,
  actorUserId: string,
  membershipId: string,
  toggles: ManagerToggles,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canPromoteManagers) {
    throw new Error("Only the owner can edit manager permissions");
  }

  const db = requireDb();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.id, membershipId),
      eq(memberships.activityId, activityId),
      eq(memberships.role, "manager"),
    ),
  });
  if (!membership) throw new Error("Manager not found");

  const existing = await db.query.managerPermissions.findFirst({
    where: eq(managerPermissions.membershipId, membershipId),
  });
  if (existing) {
    await db
      .update(managerPermissions)
      .set({ ...toggles, updatedAt: new Date() })
      .where(eq(managerPermissions.membershipId, membershipId));
  } else {
    await db.insert(managerPermissions).values({
      membershipId,
      ...toggles,
    });
  }
}
