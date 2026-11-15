import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityList } from "@/components/activity-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { listMyActivities } from "@/server/activities";

export const instant = false;

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const activities = await listMyActivities(user.id);
  const label = user.displayName || user.phone;

  return (
    <DashboardShell userLabel={label}>
      <div className="mb-6 flex flex-wrap gap-3 sm:hidden">
        <Button asChild size="sm">
          <Link href="/activities/new">Create</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/activities/join">Join</Link>
        </Button>
      </div>
      <ActivityList activities={activities} />
    </DashboardShell>
  );
}
