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
  "weekly",
  "custom",
]);

export const joinModeEnum = pgEnum("join_mode", ["must_approve", "open"]);

export const proxyConfirmScopeEnum = pgEnum("proxy_confirm_scope", [
  "off",
  "managers",
  "members",
  "both",
]);

/**
 * Activity-level schedule / registration timing defaults (JSON).
 * Per-event overrides live on occurrences later; ranks can override merge timing by id.
 */
export type ScheduleDefaultsJson = {
  /** Hours before start when registration opens (activity default). */
  registrationOpensHoursBefore: number;
  /** Hours before start when ranks merge into the main list (fallback). */
  defaultRankMergeHoursBefore: number;
  /** Optional per-rank merge timing: rankId -> hours before start. */
  rankMergeHoursBeforeByRankId?: Record<string, number>;
};

export const DEFAULT_SCHEDULE_DEFAULTS: ScheduleDefaultsJson = {
  registrationOpensHoursBefore: 48,
  defaultRankMergeHoursBefore: 24,
  rankMergeHoursBeforeByRankId: {},
};

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  typeText: text("type_text").notNull().default(""),
  timezone: text("timezone").notNull().default("Asia/Jerusalem"),
  scheduleMode: scheduleModeEnum("schedule_mode")
    .notNull()
    .default("custom"),
  /** 0=Sunday … 6=Saturday (JS getDay). Used when scheduleMode is weekly. */
  weeklyWeekday: integer("weekly_weekday"),
  /** Wall-clock time `HH:mm` in the activity timezone. */
  weeklyTime: text("weekly_time"),
  /** Default venue / place text; occurrences may override. */
  defaultPlace: text("default_place"),
  /** JSON string of ScheduleDefaultsJson. */
  scheduleDefaultsJson: text("schedule_defaults_json")
    .notNull()
    .default("{}"),
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
