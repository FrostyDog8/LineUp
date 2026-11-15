import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { activities } from "./activities";

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
