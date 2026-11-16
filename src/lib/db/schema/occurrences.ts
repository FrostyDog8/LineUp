import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { activities } from "./activities";
import { ranks } from "./ranks";

export const occurrenceStatusEnum = pgEnum("occurrence_status", [
  "scheduled",
  "registration_open",
  "closed",
  "cancelled",
]);

export const occurrences = pgTable("occurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => activities.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  capacity: integer("capacity"),
  /** Venue override; null means use activity defaultPlace. */
  place: text("place"),
  status: occurrenceStatusEnum("status").notNull().default("scheduled"),
  /** Optional short title within a series (shown under the start time). */
  subHeadline: text("sub_headline"),
  notes: text("notes"),
  /**
   * Registration-open override for this occurrence only.
   * Null means use activity schedule defaults.
   */
  registrationOpensAt: timestamp("registration_opens_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Track scheduled job ids per occurrence phase (Inngest / cron) for cancel/reschedule. */
export const policyJobs = pgTable("policy_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  occurrenceId: uuid("occurrence_id")
    .notNull()
    .references(() => occurrences.id, { onDelete: "cascade" }),
  phaseKey: text("phase_key").notNull(),
  externalJobId: text("external_job_id"),
  runAt: timestamp("run_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Which ranks have been merged onto the main line for an occurrence. */
export const occurrenceRankMerges = pgTable(
  "occurrence_rank_merges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => occurrences.id, { onDelete: "cascade" }),
    rankId: uuid("rank_id")
      .notNull()
      .references(() => ranks.id, { onDelete: "cascade" }),
    mergedAt: timestamp("merged_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** from_open | schedule | manual */
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("occurrence_rank_merges_occurrence_rank_uid").on(
      t.occurrenceId,
      t.rankId,
    ),
  ],
);

/**
 * Per-occurrence overrides of activity rank merge timing.
 * When a row exists, it replaces the activity default for this event only.
 * Scheduled overrides always use absolute merge_at (not weekday+time).
 */
export const occurrenceRankMergeOverrides = pgTable(
  "occurrence_rank_merge_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => occurrences.id, { onDelete: "cascade" }),
    rankId: uuid("rank_id")
      .notNull()
      .references(() => ranks.id, { onDelete: "cascade" }),
    mergeMode: text("merge_mode").notNull(),
    mergeAt: timestamp("merge_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("occurrence_rank_merge_overrides_occurrence_rank_uid").on(
      t.occurrenceId,
      t.rankId,
    ),
  ],
);
