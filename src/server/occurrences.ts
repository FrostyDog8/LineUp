import { and, asc, eq, gt, ne } from "drizzle-orm";
import { assertFutureStart, nextWeeklyStarts } from "@/lib/datetime";
import { requireDb } from "@/lib/db";
import { occurrences } from "@/lib/db/schema";
import { getActivityAccess } from "./permissions";
import { getActivityById } from "./activities";

const WEEKLY_WINDOW = 5;

export type OccurrenceRow = {
  id: string;
  activityId: string;
  startsAt: Date;
  capacity: number | null;
  place: string | null;
  status: "scheduled" | "registration_open" | "closed" | "cancelled";
  subHeadline: string | null;
  notes: string | null;
};

export type CreateOccurrenceInput = {
  startsAt: Date;
  capacity?: number | null;
  place?: string | null;
  subHeadline?: string | null;
  notes?: string | null;
};

export type UpdateOccurrenceInput = {
  startsAt?: Date;
  capacity?: number | null;
  place?: string | null;
  subHeadline?: string | null;
  notes?: string | null;
  status?: OccurrenceRow["status"];
};

async function assertCanEditEvents(
  activityId: string,
  actorUserId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canEditEvents) {
    throw new Error("You cannot edit events for this activity");
  }
}

function mapOccurrence(row: typeof occurrences.$inferSelect): OccurrenceRow {
  return {
    id: row.id,
    activityId: row.activityId,
    startsAt: row.startsAt,
    capacity: row.capacity,
    place: row.place,
    status: row.status,
    subHeadline: row.subHeadline,
    notes: row.notes,
  };
}

export async function listOccurrences(
  activityId: string,
): Promise<OccurrenceRow[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(occurrences)
    .where(eq(occurrences.activityId, activityId))
    .orderBy(asc(occurrences.startsAt));

  return rows.map(mapOccurrence);
}

export async function getOccurrence(
  activityId: string,
  occurrenceId: string,
): Promise<OccurrenceRow | null> {
  const db = requireDb();
  const row = await db.query.occurrences.findFirst({
    where: and(
      eq(occurrences.id, occurrenceId),
      eq(occurrences.activityId, activityId),
    ),
  });
  if (!row) return null;
  return mapOccurrence(row);
}

/**
 * Keep ~5 future weekly events. Call from activity page load / add-event path.
 * Safe no-op for custom schedules or incomplete weekly config.
 */
export async function ensureWeeklyOccurrences(
  activityId: string,
): Promise<number> {
  const activity = await getActivityById(activityId);
  if (!activity) return 0;
  if (activity.scheduleMode !== "weekly") return 0;
  if (activity.weeklyWeekday == null || !activity.weeklyTime) return 0;

  const db = requireDb();
  const now = new Date();
  const future = await db
    .select()
    .from(occurrences)
    .where(
      and(
        eq(occurrences.activityId, activityId),
        gt(occurrences.startsAt, now),
        ne(occurrences.status, "cancelled"),
      ),
    )
    .orderBy(asc(occurrences.startsAt));

  const needed = WEEKLY_WINDOW - future.length;
  if (needed <= 0) return 0;

  const after =
    future.length > 0
      ? future[future.length - 1]!.startsAt
      : now;

  const existingTimes = new Set(
    (await listOccurrences(activityId)).map((o) => o.startsAt.getTime()),
  );

  const candidates = nextWeeklyStarts(
    activity.weeklyWeekday,
    activity.weeklyTime,
    activity.timezone,
    needed + 2,
    after,
  );

  let created = 0;
  for (const startsAt of candidates) {
    if (created >= needed) break;
    if (startsAt.getTime() <= now.getTime()) continue;
    if (existingTimes.has(startsAt.getTime())) continue;
    await db.insert(occurrences).values({
      activityId,
      startsAt,
      capacity: null,
      place: null,
    });
    existingTimes.add(startsAt.getTime());
    created += 1;
  }

  return created;
}

export async function createOccurrence(
  activityId: string,
  actorUserId: string,
  input: CreateOccurrenceInput,
): Promise<OccurrenceRow> {
  await assertCanEditEvents(activityId, actorUserId);

  const activity = await getActivityById(activityId);
  if (!activity) throw new Error("Activity not found");

  assertFutureStart(input.startsAt);

  if (input.capacity != null && input.capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }

  const db = requireDb();
  const [row] = await db
    .insert(occurrences)
    .values({
      activityId,
      startsAt: input.startsAt,
      capacity: input.capacity ?? null,
      place: input.place?.trim() || null,
      subHeadline: input.subHeadline?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .returning();

  if (!row) throw new Error("Failed to create event");

  // Keep the weekly window topped up after manual adds.
  if (activity.scheduleMode === "weekly") {
    await ensureWeeklyOccurrences(activityId);
  }

  return mapOccurrence(row);
}

export async function updateOccurrence(
  activityId: string,
  actorUserId: string,
  occurrenceId: string,
  input: UpdateOccurrenceInput,
): Promise<OccurrenceRow> {
  await assertCanEditEvents(activityId, actorUserId);

  const existing = await getOccurrence(activityId, occurrenceId);
  if (!existing) throw new Error("Event not found");

  if (input.startsAt !== undefined) {
    assertFutureStart(input.startsAt);
  }

  if (input.capacity != null && input.capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }

  const patch: Partial<typeof occurrences.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.place !== undefined) patch.place = input.place?.trim() || null;
  if (input.subHeadline !== undefined) {
    patch.subHeadline = input.subHeadline?.trim() || null;
  }
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;

  const db = requireDb();
  const [row] = await db
    .update(occurrences)
    .set(patch)
    .where(
      and(
        eq(occurrences.id, occurrenceId),
        eq(occurrences.activityId, activityId),
      ),
    )
    .returning();

  if (!row) throw new Error("Failed to update event");

  return mapOccurrence(row);
}

/**
 * Manually open registration on one upcoming scheduled event.
 * Owner or manager (canEditEvents). Scheduled auto-open jobs are still future work.
 */
export async function openRegistrationForOccurrence(
  activityId: string,
  actorUserId: string,
  occurrenceId: string,
): Promise<void> {
  const access = await getActivityAccess(activityId, actorUserId);
  if (!access?.canEditEvents) {
    throw new Error("You cannot open registration for this activity");
  }

  const existing = await getOccurrence(activityId, occurrenceId);
  if (!existing) throw new Error("Event not found");
  if (existing.startsAt.getTime() <= Date.now()) {
    throw new Error("Cannot open registration on a past event");
  }
  if (existing.status !== "scheduled") {
    throw new Error("Registration is already open for this event");
  }

  const db = requireDb();
  const [row] = await db
    .update(occurrences)
    .set({ status: "registration_open", updatedAt: new Date() })
    .where(
      and(
        eq(occurrences.id, occurrenceId),
        eq(occurrences.activityId, activityId),
        eq(occurrences.status, "scheduled"),
      ),
    )
    .returning({ id: occurrences.id });

  if (!row) throw new Error("Could not open registration");

  // Apply from_open rank merges immediately (lazy scheduled merges too).
  const { applyDueMerges } = await import("./registration");
  await applyDueMerges(activityId, occurrenceId);
}

/** Delete an upcoming event; weekly activities are topped up afterward. */
export async function deleteOccurrence(
  activityId: string,
  actorUserId: string,
  occurrenceId: string,
): Promise<void> {
  await assertCanEditEvents(activityId, actorUserId);

  const existing = await getOccurrence(activityId, occurrenceId);
  if (!existing) throw new Error("Event not found");
  if (existing.startsAt.getTime() <= Date.now()) {
    throw new Error("Only upcoming events can be removed");
  }

  const db = requireDb();
  await db
    .delete(occurrences)
    .where(
      and(
        eq(occurrences.id, occurrenceId),
        eq(occurrences.activityId, activityId),
      ),
    );

  await ensureWeeklyOccurrences(activityId);
}
