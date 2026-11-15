import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * App user identity. Phone (E.164) is the unique key for MVP auth.
 * Better Auth session/account tables may sit alongside this; phone stays canonical.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull().unique(),
  displayName: text("display_name"),
  timezone: text("timezone").default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Better Auth–compatible session rows (scaffold; wire adapter in M1 exit). */
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Short-lived OTP hashes or magic-link tokens when not fully inside Better Auth. */
export const verificationChallenges = pgTable("verification_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull(),
  kind: text("kind").notNull(), // otp | magic_link
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
