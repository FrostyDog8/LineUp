import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { RanksSettings } from "@/components/ranks-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getActivityById } from "@/server/activities";
import { getActivityAccess } from "@/server/permissions";
import { listRanks } from "@/server/ranks";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function ActivityRanksPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const activity = await getActivityById(id);
  if (!activity) notFound();

  const access = await getActivityAccess(id, user.id);
  if (!access?.canManageSettings) redirect(`/activities/${id}`);

  const ranks = await listRanks(id);
  const defaultMergeWeekday =
    activity.scheduleDefaults.registrationOpensWeekday ??
    activity.weeklyWeekday ??
    1;

  return (
    <DashboardShell
      title="Ranks"
      subtitle={null}
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
      compact
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}`}>Back to activity</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}/members`}>Members</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}/settings`}>Default settings</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <RanksSettings
            activityId={id}
            timezone={activity.timezone}
            scheduleMode={activity.scheduleMode}
            defaultMergeWeekday={defaultMergeWeekday}
            ranks={ranks}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
