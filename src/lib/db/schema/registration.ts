import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { occurrences } from "./occurrences";
import { users } from "./users";

export const registrationKindEnum = pgEnum("registration_kind", [
  "member",
  "guest",
]);

export const registrationLineEnum = pgEnum("registration_line", [
  "main",
  "wait",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "registered",
  "waitlisted",
  "confirmed",
  "cut",
  "cancelled",
]);

export const confirmSourceEnum = pgEnum("confirm_source", [
  "self",
  "proxy",
  "policy",
  "manual",
]);

export const registrationEntries = pgTable(
  "registration_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => occurrences.id, { onDelete: "cascade" }),
    kind: registrationKindEnum("kind").notNull().default("member"),
    userId: uuid("user_id").references(() => users.id),
    guestName: text("guest_name"),
    line: registrationLineEnum("line").notNull().default("main"),
    position: integer("position"),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: registrationStatusEnum("status").notNull().default("registered"),
    confirmSource: confirmSourceEnum("confirm_source"),
    countsTowardCapacity: boolean("counts_toward_capacity")
      .notNull()
      .default(true),
    manualOverride: boolean("manual_override").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("registration_entries_occurrence_user_uid")
      .on(t.occurrenceId, t.userId)
      .where(sql`${t.userId} is not null and ${t.status} <> 'cancelled'`),
  ],
);

export const registrationAudits = pgTable("registration_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  occurrenceId: uuid("occurrence_id")
    .notNull()
    .references(() => occurrences.id, { onDelete: "cascade" }),
  entryId: uuid("entry_id").references(() => registrationEntries.id, {
    onDelete: "set null",
  }),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  detailJson: text("detail_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
