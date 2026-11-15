import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { memberships } from "./memberships";

/** Thin manager permission toggles (MVP catalog). */
export const managerPermissions = pgTable("manager_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  membershipId: uuid("membership_id")
    .notNull()
    .unique()
    .references(() => memberships.id, { onDelete: "cascade" }),
  approveJoins: boolean("approve_joins").notNull().default(false),
  changeRanks: boolean("change_ranks").notNull().default(false),
  editLists: boolean("edit_lists").notNull().default(false),
  proxyConfirm: boolean("proxy_confirm").notNull().default(false),
  addGuests: boolean("add_guests").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
