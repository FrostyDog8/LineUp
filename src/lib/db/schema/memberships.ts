import { pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { activities } from "./activities";
import { ranks } from "./ranks";
import { users } from "./users";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "manager",
  "participant",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "requested",
  "active",
  "left",
  "removed",
]);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("participant"),
    rankId: uuid("rank_id").references(() => ranks.id),
    status: membershipStatusEnum("status").notNull().default("requested"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("memberships_activity_user_uid").on(t.activityId, t.userId)],
);
