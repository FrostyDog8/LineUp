import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const scheduleModeEnum = pgEnum("schedule_mode", [
  "one_time",
  "recurring_simple",
]);

export const joinModeEnum = pgEnum("join_mode", ["must_approve", "open"]);

export const proxyConfirmScopeEnum = pgEnum("proxy_confirm_scope", [
  "off",
  "managers",
  "members",
  "both",
]);

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  typeText: text("type_text").notNull().default(""),
  timezone: text("timezone").notNull().default("UTC"),
  scheduleMode: scheduleModeEnum("schedule_mode")
    .notNull()
    .default("one_time"),
  joinMode: joinModeEnum("join_mode").notNull().default("must_approve"),
  defaultCapacity: integer("default_capacity").notNull().default(18),
  defaultRankId: uuid("default_rank_id"),
  proxyConfirmScope: proxyConfirmScopeEnum("proxy_confirm_scope")
    .notNull()
    .default("off"),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  inviteSlug: text("invite_slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Policy JSON (phases, merge, capacity thresholds) — validated with Zod in M3. */
export const registrationPolicies = pgTable("registration_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  activityId: uuid("activity_id")
    .notNull()
    .unique()
    .references(() => activities.id, { onDelete: "cascade" }),
  policyJson: text("policy_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
