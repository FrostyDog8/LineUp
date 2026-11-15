import type { activities } from "@/lib/db/schema";

export type ActivitySummary = {
  id: string;
  name: string;
  typeText: string;
  role: "owner" | "manager" | "participant";
  timezone: string;
};

/**
 * Domain module stub — returns empty until Drizzle queries are wired (M2).
 */
export async function listMyActivities(
  _userId: string,
): Promise<ActivitySummary[]> {
  void _userId;
  return [];
}

export type CreateActivityInput = {
  name: string;
  typeText: string;
  timezone: string;
  defaultCapacity: number;
  joinMode: "must_approve" | "open";
};

export async function createActivityStub(
  _userId: string,
  _input: CreateActivityInput,
): Promise<typeof activities.$inferSelect | null> {
  // M2: insert activity + owner membership + default ranks in a transaction.
  return null;
}
