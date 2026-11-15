/**
 * Pure registration-engine helpers (no DB / HTTP).
 * Volleyball weekly flow is one configuration of these building blocks.
 */

export type RegistrationLine = "main" | "wait";

export type RegistrationStatus =
  | "registered"
  | "waitlisted"
  | "confirmed"
  | "cut"
  | "cancelled";

export type EngineEntry = {
  id: string;
  userId: string | null;
  rankId: string | null;
  /** Lower number = higher priority (member=10, New=100). */
  rankSortPriority: number;
  line: RegistrationLine;
  status: RegistrationStatus;
  registeredAt: Date;
  /** Secondary order within the same registeredAt (waitlist order on merge). */
  position: number | null;
  countsTowardCapacity: boolean;
};

export type PlaceDecision = {
  line: RegistrationLine;
  status: Extract<RegistrationStatus, "registered" | "waitlisted">;
  reason: string;
};

function isActive(entry: EngineEntry): boolean {
  return entry.status !== "cancelled" && entry.status !== "cut";
}

function countsOnMain(entry: EngineEntry): boolean {
  return (
    isActive(entry) &&
    entry.line === "main" &&
    entry.countsTowardCapacity &&
    (entry.status === "registered" ||
      entry.status === "confirmed" ||
      entry.status === "waitlisted")
  );
}

/** Main-list slots currently occupied (capacity consumers). */
export function countMainOccupancy(entries: EngineEntry[]): number {
  return entries.filter(countsOnMain).length;
}

/**
 * Where a newly registering member lands.
 * Main-eligible ranks fill main until capacity; overflow and unmerged ranks → wait.
 */
export function decidePlacement(input: {
  rankMerged: boolean;
  mainOccupancy: number;
  capacity: number;
}): PlaceDecision {
  if (!input.rankMerged) {
    return {
      line: "wait",
      status: "waitlisted",
      reason: "Your rank is on the wait line until it merges into main.",
    };
  }
  if (input.mainOccupancy >= input.capacity) {
    return {
      line: "wait",
      status: "waitlisted",
      reason: "Main list is full — you are on the wait line.",
    };
  }
  return {
    line: "main",
    status: "registered",
    reason: "You are on the main list.",
  };
}

/** Compare for display / capacity selection: rank priority, then time, then position. */
export function compareRankThenTime(a: EngineEntry, b: EngineEntry): number {
  if (a.rankSortPriority !== b.rankSortPriority) {
    return a.rankSortPriority - b.rankSortPriority;
  }
  const ta = a.registeredAt.getTime();
  const tb = b.registeredAt.getTime();
  if (ta !== tb) return ta - tb;
  const pa = a.position ?? 0;
  const pb = b.position ?? 0;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
}

/** Post-merge ordering: effective time, then prior wait order (position). */
export function compareTimeThenWaitOrder(a: EngineEntry, b: EngineEntry): number {
  const ta = a.registeredAt.getTime();
  const tb = b.registeredAt.getTime();
  if (ta !== tb) return ta - tb;
  const pa = a.position ?? 0;
  const pb = b.position ?? 0;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
}

export function sortEntries(
  entries: EngineEntry[],
  mode: "rank_then_time" | "time_then_wait_order" = "rank_then_time",
): EngineEntry[] {
  const cmp =
    mode === "time_then_wait_order"
      ? compareTimeThenWaitOrder
      : compareRankThenTime;
  return [...entries].sort(cmp);
}

export function withLinePositions(
  entries: EngineEntry[],
  mode: "rank_then_time" | "time_then_wait_order" = "rank_then_time",
): EngineEntry[] {
  const main = sortEntries(
    entries.filter((e) => isActive(e) && e.line === "main"),
    mode,
  ).map((e, i) => ({ ...e, position: i + 1 }));
  const wait = sortEntries(
    entries.filter((e) => isActive(e) && e.line === "wait"),
    mode,
  ).map((e, i) => ({ ...e, position: i + 1 }));
  const inactive = entries.filter((e) => !isActive(e) || (e.line !== "main" && e.line !== "wait"));
  return [...main, ...wait, ...inactive];
}

/**
 * Merge wait-line entries for `rankId` onto main.
 * Waiters enter as registered_at = mergeAt, preserving waitlist order via position.
 * Then refill main up to capacity (overflow stays wait).
 */
export function applyRankMerge(
  entries: EngineEntry[],
  rankId: string,
  mergeAt: Date,
  capacity: number,
): EngineEntry[] {
  const waiters = sortEntries(
    entries.filter(
      (e) =>
        isActive(e) &&
        e.line === "wait" &&
        e.rankId === rankId,
    ),
    "rank_then_time",
  );

  const waiterIds = new Set(waiters.map((e) => e.id));
  const mergedWaiters = waiters.map((e, i) => ({
    ...e,
    line: "main" as const,
    status: "registered" as const,
    registeredAt: mergeAt,
    position: i + 1,
  }));

  const others = entries.filter((e) => !waiterIds.has(e.id));
  const combined = [...others, ...mergedWaiters];
  return rebalanceMainCapacity(combined, capacity, "time_then_wait_order");
}

/**
 * Keep top `capacity` main entries on main; push overflow to wait.
 * Ordering mode controls who stays when over capacity.
 */
export function rebalanceMainCapacity(
  entries: EngineEntry[],
  capacity: number,
  mode: "rank_then_time" | "time_then_wait_order" = "rank_then_time",
): EngineEntry[] {
  const main = sortEntries(
    entries.filter((e) => isActive(e) && e.line === "main"),
    mode,
  );
  const keep = new Set(main.slice(0, Math.max(0, capacity)).map((e) => e.id));
  const next = entries.map((e) => {
    if (!isActive(e) || e.line !== "main") return e;
    if (keep.has(e.id)) {
      return {
        ...e,
        status:
          e.status === "confirmed" ? ("confirmed" as const) : ("registered" as const),
      };
    }
    return {
      ...e,
      line: "wait" as const,
      status: "waitlisted" as const,
    };
  });
  return withLinePositions(next, mode);
}

/**
 * After a main/confirmed cancel: promote the next eligible waiter onto main.
 * Eligible = rank already merged (caller filters waiters to merged ranks only).
 */
export function promoteNextWaiter(
  entries: EngineEntry[],
  capacity: number,
  mergedRankIds: Set<string>,
  now: Date = new Date(),
): { entries: EngineEntry[]; promotedId: string | null } {
  const occupancy = countMainOccupancy(entries);
  if (occupancy >= capacity) {
    return { entries: withLinePositions(entries), promotedId: null };
  }

  const candidates = sortEntries(
    entries.filter(
      (e) =>
        isActive(e) &&
        e.line === "wait" &&
        e.rankId != null &&
        mergedRankIds.has(e.rankId),
    ),
    "rank_then_time",
  );

  const next = candidates[0];
  if (!next) {
    return { entries: withLinePositions(entries), promotedId: null };
  }

  const updated = entries.map((e) =>
    e.id === next.id
      ? {
          ...e,
          line: "main" as const,
          status: "registered" as const,
          registeredAt: e.registeredAt.getTime() > now.getTime() ? e.registeredAt : now,
        }
      : e,
  );

  return {
    entries: withLinePositions(updated),
    promotedId: next.id,
  };
}

export function explainStatus(input: {
  line: RegistrationLine;
  status: RegistrationStatus;
  position: number | null;
  rankMerged: boolean;
  rankName: string | null;
}): string {
  if (input.status === "cancelled") return "You cancelled this registration.";
  if (input.status === "cut") return "You were cut when capacity was applied.";
  if (input.status === "confirmed") {
    return input.position
      ? `Confirmed attending · #${input.position} on main`
      : "Confirmed attending";
  }
  if (input.line === "main") {
    return input.position
      ? `Main list · #${input.position}`
      : "On the main list";
  }
  if (!input.rankMerged && input.rankName) {
    return `Wait line · ${input.rankName} merges later`;
  }
  return input.position
    ? `Wait line · #${input.position}`
    : "On the wait line";
}
