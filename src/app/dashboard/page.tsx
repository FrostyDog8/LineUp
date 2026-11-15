import { ActivityList } from "@/components/activity-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { listMyActivities } from "@/server/activities";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const activities = user ? await listMyActivities(user.id) : [];

  return (
    <DashboardShell>
      {!user ? (
        <p className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Auth is stubbed for M1 — you&apos;re viewing the empty dashboard shell.
          Sign-in with phone OTP / magic link will populate this list.
        </p>
      ) : null}
      <ActivityList activities={activities} />
    </DashboardShell>
  );
}
