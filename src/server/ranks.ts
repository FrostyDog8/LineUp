import { and, asc, eq, ne } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { activities, memberships, ranks } from "@/lib/db/schema";
import { parseWeeklyTime } from "@/lib/datetime";
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
  mergeWeekday: number | null;
  mergeTime: string | null;
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
    mergeWeekday:
      typeof row.mergeWeekday === "number" &&
      row.mergeWeekday >= 0 &&
      row.mergeWeekday <= 6
        ? row.mergeWeekday
        : null,
    mergeTime: row.mergeTime ?? null,
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

export type RankMergeInput = {
  name?: string;
  mergeMode?: RankMergeMode;
  mergeAt?: Date | null;
  mergeWeekday?: number | null;
  mergeTime?: string | null;
};

function normalizeMergePatch(
  input: RankMergeInput,
  existing?: typeof ranks.$inferSelect,
): Partial<typeof ranks.$inferInsert> {
  const patch: Partial<typeof ranks.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Rank name is required");
    patch.name = name;
  }

  const nextMode =
    input.mergeMode !== undefined
      ? input.mergeMode === "scheduled"
        ? "scheduled"
        : "manual"
      : existing
        ? existing.mergeMode === "scheduled"
          ? "scheduled"
          : "manual"
        : "manual";

  if (input.mergeMode !== undefined) {
    patch.mergeMode = nextMode;
  }

  if (nextMode === "manual") {
    if (input.mergeMode !== undefined || input.mergeAt !== undefined) {
      patch.mergeAt = null;
    }
    if (input.mergeMode !== undefined || input.mergeWeekday !== undefined) {
      patch.mergeWeekday = null;
    }
    if (input.mergeMode !== undefined || input.mergeTime !== undefined) {
      patch.mergeTime = null;
    }
    return patch;
  }

  if (input.mergeAt !== undefined) {
    patch.mergeAt = input.mergeAt;
  }
  if (input.mergeWeekday !== undefined) {
    if (
      input.mergeWeekday != null &&
      (input.mergeWeekday < 0 || input.mergeWeekday > 6)
    ) {
      throw new Error("Merge day must be Sunday–Saturday");
    }
    patch.mergeWeekday = input.mergeWeekday;
  }
  if (input.mergeTime !== undefined) {
    if (input.mergeTime) {
      parseWeeklyTime(input.mergeTime);
      patch.mergeTime = input.mergeTime.trim();
    } else {
      patch.mergeTime = null;
    }
  }

  return patch;
}

export async function createRank(
  activityId: string,
  actorUserId: string,
  input: RankMergeInput = {},
): Promise<RankRow> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canManageSettings) {
    throw new Error("Only the owner can create ranks");
  }
  const name = (input.name ?? "New rank").trim() || "New rank";
  const mergeMode = input.mergeMode === "scheduled" ? "scheduled" : "manual";

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
      mergeWeekday:
        mergeMode === "scheduled" ? (input.mergeWeekday ?? null) : null,
      mergeTime: mergeMode === "scheduled" ? (input.mergeTime ?? null) : null,
    })
    .returning();
  if (!row) throw new Error("Failed to create rank");
  return mapRank(row);
}

export async function updateRank(
  activityId: string,
  actorUserId: string,
  rankId: string,
  input: RankMergeInput,
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

  const patch = normalizeMergePatch(input, existing);
  if (Object.keys(patch).length === 0) return mapRank(existing);

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
