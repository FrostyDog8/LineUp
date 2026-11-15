import { and, asc, eq, ne } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { activities, memberships, ranks } from "@/lib/db/schema";
import { getActivityAccess } from "./permissions";

export type RankRow = {
  id: string;
  activityId: string;
  name: string;
  sortPriority: number;
  isDefault: boolean;
};

export async function listRanks(activityId: string): Promise<RankRow[]> {
  const db = requireDb();
  return db
    .select({
      id: ranks.id,
      activityId: ranks.activityId,
      name: ranks.name,
      sortPriority: ranks.sortPriority,
      isDefault: ranks.isDefault,
    })
    .from(ranks)
    .where(eq(ranks.activityId, activityId))
    .orderBy(asc(ranks.sortPriority), asc(ranks.name));
}

export async function createRank(
  activityId: string,
  actorUserId: string,
  input: { name: string; sortPriority?: number },
): Promise<RankRow> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can create ranks");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Rank name is required");

  const db = requireDb();
  const [row] = await db
    .insert(ranks)
    .values({
      activityId,
      name,
      sortPriority: input.sortPriority ?? 100,
      isDefault: false,
    })
    .returning();
  if (!row) throw new Error("Failed to create rank");
  return row;
}

export async function updateRank(
  activityId: string,
  actorUserId: string,
  rankId: string,
  input: { name?: string; sortPriority?: number },
): Promise<RankRow> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can edit ranks");
  }

  const db = requireDb();
  const existing = await db.query.ranks.findFirst({
    where: and(eq(ranks.id, rankId), eq(ranks.activityId, activityId)),
  });
  if (!existing) throw new Error("Rank not found");

  const patch: Partial<typeof ranks.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Rank name is required");
    patch.name = name;
  }
  if (input.sortPriority !== undefined) patch.sortPriority = input.sortPriority;

  const [row] = await db
    .update(ranks)
    .set(patch)
    .where(eq(ranks.id, rankId))
    .returning();
  if (!row) throw new Error("Failed to update rank");
  return row;
}

export async function setDefaultRank(
  activityId: string,
  actorUserId: string,
  rankId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can set the default rank");
  }

  const db = requireDb();
  const existing = await db.query.ranks.findFirst({
    where: and(eq(ranks.id, rankId), eq(ranks.activityId, activityId)),
  });
  if (!existing) throw new Error("Rank not found");

  await db.transaction(async (tx) => {
    await tx
      .update(ranks)
      .set({ isDefault: false })
      .where(
        and(eq(ranks.activityId, activityId), ne(ranks.id, rankId)),
      );
    await tx
      .update(ranks)
      .set({ isDefault: true })
      .where(eq(ranks.id, rankId));
    await tx
      .update(activities)
      .set({ defaultRankId: rankId, updatedAt: new Date() })
      .where(eq(activities.id, activityId));
  });
}

export async function deleteRank(
  activityId: string,
  actorUserId: string,
  rankId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can delete ranks");
  }

  const db = requireDb();
  const existing = await db.query.ranks.findFirst({
    where: and(eq(ranks.id, rankId), eq(ranks.activityId, activityId)),
  });
  if (!existing) throw new Error("Rank not found");

  const all = await listRanks(activityId);
  if (all.length <= 1) {
    throw new Error("Cannot delete the only remaining rank on this activity");
  }

  const activity = await db.query.activities.findFirst({
    where: eq(activities.id, activityId),
  });
  const fallback = all.find((r) => r.id !== rankId);
  if (!fallback) throw new Error("No fallback rank");

  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ rankId: fallback.id, updatedAt: new Date() })
      .where(
        and(eq(memberships.activityId, activityId), eq(memberships.rankId, rankId)),
      );

    if (activity?.defaultRankId === rankId) {
      await tx
        .update(activities)
        .set({ defaultRankId: fallback.id, updatedAt: new Date() })
        .where(eq(activities.id, activityId));
      await tx
        .update(ranks)
        .set({ isDefault: true })
        .where(eq(ranks.id, fallback.id));
    }

    await tx.delete(ranks).where(eq(ranks.id, rankId));
  });
}
