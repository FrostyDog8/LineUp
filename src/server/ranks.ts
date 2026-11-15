import { and, asc, eq, ne } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { activities, memberships, ranks } from "@/lib/db/schema";
import { getActivityAccess } from "./permissions";

export type RankMergeMode = "manual" | "scheduled";

export type RankRow = {
  id: string;
  activityId: string;
  name: string;
  sortPriority: number;
  isDefault: boolean;
  mergeMode: RankMergeMode;
  mergeAt: Date | null;
  createdAt: Date;
};

function mapRank(row: typeof ranks.$inferSelect): RankRow {
  return {
    id: row.id,
    activityId: row.activityId,
    name: row.name,
    sortPriority: row.sortPriority,
    isDefault: row.isDefault,
    mergeMode: row.mergeMode === "scheduled" ? "scheduled" : "manual",
    mergeAt: row.mergeAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function listRanks(activityId: string): Promise<RankRow[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(ranks)
    .where(eq(ranks.activityId, activityId))
    .orderBy(asc(ranks.createdAt), asc(ranks.name));
  return rows.map(mapRank);
}

export async function createRank(
  activityId: string,
  actorUserId: string,
  input: {
    name?: string;
    mergeMode?: RankMergeMode;
    mergeAt?: Date | null;
  } = {},
): Promise<RankRow> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can create ranks");
  }
  const name = (input.name ?? "New rank").trim() || "New rank";
  const mergeMode = input.mergeMode === "scheduled" ? "scheduled" : "manual";
  if (mergeMode === "scheduled" && !input.mergeAt) {
    throw new Error("Pick a merge date and time");
  }

  const db = requireDb();
  const existing = await listRanks(activityId);
  const [row] = await db
    .insert(ranks)
    .values({
      activityId,
      name,
      sortPriority: (existing.length + 1) * 10,
      isDefault: false,
      mergeMode,
      mergeAt: mergeMode === "scheduled" ? (input.mergeAt ?? null) : null,
    })
    .returning();
  if (!row) throw new Error("Failed to create rank");
  return mapRank(row);
}

export async function updateRank(
  activityId: string,
  actorUserId: string,
  rankId: string,
  input: {
    name?: string;
    mergeMode?: RankMergeMode;
    mergeAt?: Date | null;
  },
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
  if (input.mergeMode !== undefined) {
    const mergeMode =
      input.mergeMode === "scheduled" ? "scheduled" : "manual";
    patch.mergeMode = mergeMode;
    if (mergeMode === "manual") {
      patch.mergeAt = null;
    } else if (input.mergeAt !== undefined) {
      if (!input.mergeAt) throw new Error("Pick a merge date and time");
      patch.mergeAt = input.mergeAt;
    } else if (!existing.mergeAt) {
      throw new Error("Pick a merge date and time");
    }
  } else if (input.mergeAt !== undefined) {
    if (existing.mergeMode === "scheduled" || input.mergeAt) {
      patch.mergeAt = input.mergeAt;
    }
  }

  const [row] = await db
    .update(ranks)
    .set(patch)
    .where(eq(ranks.id, rankId))
    .returning();
  if (!row) throw new Error("Failed to update rank");
  return mapRank(row);
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
      .where(and(eq(ranks.activityId, activityId), ne(ranks.id, rankId)));
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
        and(
          eq(memberships.activityId, activityId),
          eq(memberships.rankId, rankId),
        ),
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
