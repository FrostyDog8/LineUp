import { relations } from "drizzle-orm";
import { activities, registrationPolicies } from "./activities";
import { memberships } from "./memberships";
import { managerPermissions } from "./permissions";
import { ranks } from "./ranks";
import { sessions, users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  memberships: many(memberships),
  ownedActivities: many(activities),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  owner: one(users, {
    fields: [activities.ownerUserId],
    references: [users.id],
  }),
  ranks: many(ranks),
  memberships: many(memberships),
  policy: one(registrationPolicies),
}));

export const ranksRelations = relations(ranks, ({ one, many }) => ({
  activity: one(activities, {
    fields: [ranks.activityId],
    references: [activities.id],
  }),
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  activity: one(activities, {
    fields: [memberships.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  rank: one(ranks, {
    fields: [memberships.rankId],
    references: [ranks.id],
  }),
  permissions: one(managerPermissions),
}));

export const managerPermissionsRelations = relations(
  managerPermissions,
  ({ one }) => ({
    membership: one(memberships, {
      fields: [managerPermissions.membershipId],
      references: [memberships.id],
    }),
  }),
);

export const registrationPoliciesRelations = relations(
  registrationPolicies,
  ({ one }) => ({
    activity: one(activities, {
      fields: [registrationPolicies.activityId],
      references: [activities.id],
    }),
  }),
);
