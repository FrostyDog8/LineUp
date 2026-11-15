import { and, asc, eq } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { occurrences } from "@/lib/db/schema";
import { getActivityAccess } from "./permissions";
import { getActivityById } from "./activities";

export type OccurrenceRow = {
  id: string;
  activityId: string;
  startsAt: Date;
  capacity: number | null;
  status: "scheduled" | "registration_open" | "closed" | "cancelled";
  notes: string | null;
};

export type CreateOccurrenceInput = {
  startsAt: Date;
  capacity?: number | null;
  notes?: string | null;
};

export type UpdateOccurrenceInput = {
  startsAt?: Date;
  capacity?: number | null;
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

export async function listOccurrences(
  activityId: string,
): Promise<OccurrenceRow[]> {
  const db = requireDb();
  const rows = await db
    .select({
      id: occurrences.id,
      activityId: occurrences.activityId,
      startsAt: occurrences.startsAt,
      capacity: occurrences.capacity,
      status: occurrences.status,
      notes: occurrences.notes,
    })
    .from(occurrences)
    .where(eq(occurrences.activityId, activityId))
    .orderBy(asc(occurrences.startsAt));

  return rows;
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
  return {
    id: row.id,
    activityId: row.activityId,
    startsAt: row.startsAt,
    capacity: row.capacity,
    status: row.status,
    notes: row.notes,
  };
}

export async function createOccurrence(
  activityId: string,
  actorUserId: string,
  input: CreateOccurrenceInput,
): Promise<OccurrenceRow> {
  await assertCanEditEvents(activityId, actorUserId);

  const activity = await getActivityById(activityId);
  if (!activity) throw new Error("Activity not found");

  if (activity.scheduleMode === "one_time") {
    const existing = await listOccurrences(activityId);
    if (existing.length > 0) {
      throw new Error("One-time activities already have an event");
    }
  }

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
      notes: input.notes?.trim() || null,
    })
    .returning();

  if (!row) throw new Error("Failed to create event");

  return {
    id: row.id,
    activityId: row.activityId,
    startsAt: row.startsAt,
    capacity: row.capacity,
    status: row.status,
    notes: row.notes,
  };
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

  if (input.capacity != null && input.capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }

  const patch: Partial<typeof occurrences.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
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

  return {
    id: row.id,
    activityId: row.activityId,
    startsAt: row.startsAt,
    capacity: row.capacity,
    status: row.status,
    notes: row.notes,
  };
}
