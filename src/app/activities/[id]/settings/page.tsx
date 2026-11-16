import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DeleteActivityDialog } from "@/components/delete-activity-dialog";
import { GeneralSettingsForm } from "@/components/general-settings-form";
import { TransferOwnershipDialog } from "@/components/transfer-ownership-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getActivityById } from "@/server/activities";
import { listMembers } from "@/server/memberships";
import { getActivityAccess } from "@/server/permissions";
import { listRanks } from "@/server/ranks";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function ActivitySettingsPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const activity = await getActivityById(id);
  if (!activity) notFound();

  const access = await getActivityAccess(id, user.id);
  if (!access?.canManageSettings) redirect(`/activities/${id}`);

  const [members, ranks] = await Promise.all([
    listMembers(id),
    listRanks(id),
  ]);
  const transferCandidates = members.filter(
    (m) => m.status === "active" && m.userId !== user.id,
  );

  return (
    <DashboardShell
      title="Default settings"
      subtitle={activity.name}
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
          <Link href={`/activities/${id}/ranks`}>Ranks</Link>
        </Button>
        <TransferOwnershipDialog
          activityId={id}
          candidates={transferCandidates}
          ranks={ranks}
          defaultRankId={activity.defaultRankId}
          compact
        />
        <DeleteActivityDialog activityId={id} activityName={activity.name} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">General</CardTitle>
          <CardDescription>
            Name, schedule defaults, join mode, and capacity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeneralSettingsForm
            activityId={id}
            name={activity.name}
            defaultCapacity={activity.defaultCapacity}
            defaultPlace={activity.defaultPlace}
            scheduleMode={activity.scheduleMode}
            weeklyWeekday={activity.weeklyWeekday}
            weeklyTime={activity.weeklyTime}
            joinMode={activity.joinMode}
            defaultRankId={activity.defaultRankId}
            ranks={ranks.map((r) => ({ id: r.id, name: r.name }))}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
