import { and, eq } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import {
  activities,
  managerPermissions,
  memberships,
} from "@/lib/db/schema";

export type ManagerToggles = {
  approveJoins: boolean;
  changeRanks: boolean;
  editLists: boolean;
  proxyConfirm: boolean;
  addGuests: boolean;
};

export type ActivityAccess = {
  activityId: string;
  membershipId: string;
  role: "owner" | "manager" | "participant";
  status: "requested" | "active" | "left" | "removed";
  isOwner: boolean;
  canApproveJoins: boolean;
  canChangeRanks: boolean;
  canManageSettings: boolean;
  canPromoteManagers: boolean;
  permissions: ManagerToggles | null;
};

export async function getActivityAccess(
  activityId: string,
  userId: string,
): Promise<ActivityAccess | null> {
  const db = requireDb();
  const rows = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      status: memberships.status,
      ownerUserId: activities.ownerUserId,
      approveJoins: managerPermissions.approveJoins,
      changeRanks: managerPermissions.changeRanks,
      editLists: managerPermissions.editLists,
      proxyConfirm: managerPermissions.proxyConfirm,
      addGuests: managerPermissions.addGuests,
    })
    .from(memberships)
    .innerJoin(activities, eq(memberships.activityId, activities.id))
    .leftJoin(
      managerPermissions,
      eq(managerPermissions.membershipId, memberships.id),
    )
    .where(
      and(
        eq(memberships.activityId, activityId),
        eq(memberships.userId, userId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const isOwner = row.role === "owner" || row.ownerUserId === userId;
  const isActive = row.status === "active";
  const perms: ManagerToggles | null =
    row.role === "manager"
      ? {
          approveJoins: Boolean(row.approveJoins),
          changeRanks: Boolean(row.changeRanks),
          editLists: Boolean(row.editLists),
          proxyConfirm: Boolean(row.proxyConfirm),
          addGuests: Boolean(row.addGuests),
        }
      : null;

  return {
    activityId,
    membershipId: row.membershipId,
    role: row.role,
    status: row.status,
    isOwner,
    canApproveJoins:
      isActive && (isOwner || Boolean(perms?.approveJoins)),
    canChangeRanks: isActive && (isOwner || Boolean(perms?.changeRanks)),
    canManageSettings: isActive && isOwner,
    canPromoteManagers: isActive && isOwner,
    permissions: perms,
  };
}
