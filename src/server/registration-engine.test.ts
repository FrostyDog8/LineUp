import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRankMerge,
  compareRankThenTime,
  countMainOccupancy,
  decidePlacement,
  promoteNextWaiter,
  rebalanceMainCapacity,
  type EngineEntry,
} from "./registration-engine";

function entry(
  partial: Partial<EngineEntry> & Pick<EngineEntry, "id">,
): EngineEntry {
  return {
    userId: partial.userId ?? partial.id,
    rankId: partial.rankId ?? "rank-a",
    rankSortPriority: partial.rankSortPriority ?? 10,
    line: partial.line ?? "main",
    status: partial.status ?? "registered",
    registeredAt: partial.registeredAt ?? new Date("2026-01-01T10:00:00Z"),
    position: partial.position ?? null,
    countsTowardCapacity: partial.countsTowardCapacity ?? true,
    ...partial,
  };
}

describe("decidePlacement", () => {
  it("sends unmerged ranks to wait", () => {
    const d = decidePlacement({
      rankMerged: false,
      mainOccupancy: 0,
      capacity: 18,
    });
    assert.equal(d.line, "wait");
    assert.equal(d.status, "waitlisted");
  });

  it("puts merged ranks on main when capacity remains", () => {
    const d = decidePlacement({
      rankMerged: true,
      mainOccupancy: 2,
      capacity: 18,
    });
    assert.equal(d.line, "main");
    assert.equal(d.status, "registered");
  });

  it("overflows merged ranks to wait when main is full", () => {
    const d = decidePlacement({
      rankMerged: true,
      mainOccupancy: 18,
      capacity: 18,
    });
    assert.equal(d.line, "wait");
  });
});

describe("applyRankMerge", () => {
  it("moves waiters to main at merge time preserving wait order", () => {
    const mergeAt = new Date("2026-01-01T12:00:00Z");
    const entries = [
      entry({
        id: "m1",
        line: "main",
        rankId: "regular",
        rankSortPriority: 10,
        registeredAt: new Date("2026-01-01T10:01:00Z"),
      }),
      entry({
        id: "w1",
        line: "wait",
        status: "waitlisted",
        rankId: "new",
        rankSortPriority: 100,
        registeredAt: new Date("2026-01-01T10:05:00Z"),
      }),
      entry({
        id: "w2",
        line: "wait",
        status: "waitlisted",
        rankId: "new",
        rankSortPriority: 100,
        registeredAt: new Date("2026-01-01T10:02:00Z"),
      }),
    ];

    const next = applyRankMerge(entries, "new", mergeAt, 18);
    const w2 = next.find((e) => e.id === "w2")!;
    const w1 = next.find((e) => e.id === "w1")!;
    assert.equal(w2.line, "main");
    assert.equal(w1.line, "main");
    assert.equal(w2.registeredAt.getTime(), mergeAt.getTime());
    assert.equal(w1.registeredAt.getTime(), mergeAt.getTime());
    // Earlier waiter keeps lower wait-order position after merge.
    assert.ok((w2.position ?? 99) < (w1.position ?? 0));
  });
});

describe("promoteNextWaiter", () => {
  it("auto-promotes the next merged waiter after a main cancel", () => {
    const entries = [
      entry({
        id: "m1",
        line: "main",
        rankId: "regular",
        rankSortPriority: 10,
      }),
      entry({
        id: "w1",
        line: "wait",
        status: "waitlisted",
        rankId: "new",
        rankSortPriority: 100,
        registeredAt: new Date("2026-01-01T12:00:00Z"),
      }),
    ];
    // Simulate m1 already cancelled/removed from active set:
    const withoutMain = entries.filter((e) => e.id !== "m1");
    const result = promoteNextWaiter(
      withoutMain,
      18,
      new Set(["regular", "new"]),
    );
    assert.equal(result.promotedId, "w1");
    assert.equal(result.entries.find((e) => e.id === "w1")?.line, "main");
  });

  it("does not promote unmerged ranks", () => {
    const entries = [
      entry({
        id: "w1",
        line: "wait",
        status: "waitlisted",
        rankId: "new",
        rankSortPriority: 100,
      }),
    ];
    const result = promoteNextWaiter(entries, 18, new Set(["regular"]));
    assert.equal(result.promotedId, null);
  });
});

describe("rebalanceMainCapacity", () => {
  it("pushes overflow to wait by rank then time", () => {
    const entries = [
      entry({
        id: "a",
        rankSortPriority: 10,
        registeredAt: new Date("2026-01-01T10:00:00Z"),
      }),
      entry({
        id: "b",
        rankSortPriority: 10,
        registeredAt: new Date("2026-01-01T10:01:00Z"),
      }),
      entry({
        id: "c",
        rankId: "new",
        rankSortPriority: 100,
        registeredAt: new Date("2026-01-01T09:00:00Z"),
      }),
    ];
    const next = rebalanceMainCapacity(entries, 2, "rank_then_time");
    assert.equal(countMainOccupancy(next), 2);
    assert.equal(next.find((e) => e.id === "c")?.line, "wait");
    assert.equal(next.find((e) => e.id === "a")?.line, "main");
    assert.equal(next.find((e) => e.id === "b")?.line, "main");
  });
});

describe("compareRankThenTime", () => {
  it("orders by rank priority then registration time", () => {
    const a = entry({
      id: "a",
      rankSortPriority: 10,
      registeredAt: new Date("2026-01-01T11:00:00Z"),
    });
    const b = entry({
      id: "b",
      rankSortPriority: 100,
      registeredAt: new Date("2026-01-01T09:00:00Z"),
    });
    assert.ok(compareRankThenTime(a, b) < 0);
  });
});
