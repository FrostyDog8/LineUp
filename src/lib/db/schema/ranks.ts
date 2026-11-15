import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { activities } from "./activities";

export const ranks = pgTable("ranks", {
  id: uuid("id").defaultRandom().primaryKey(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => activities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Legacy column; UI no longer uses priority for merge order. */
  sortPriority: integer("sort_priority").notNull().default(100),
  isDefault: boolean("is_default").notNull().default(false),
  /** When this rank merges into the main list: scheduled datetime/day or manual. */
  mergeMode: text("merge_mode").notNull().default("manual"),
  /** Absolute merge instant when mergeMode is scheduled (one-time / custom). */
  mergeAt: timestamp("merge_at", { withTimezone: true }),
  /** Weekly: merge weekday 0=Sun…6=Sat when mergeMode is scheduled. */
  mergeWeekday: integer("merge_weekday"),
  /** Weekly: merge time `HH:mm` in the activity timezone. */
  mergeTime: text("merge_time"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
