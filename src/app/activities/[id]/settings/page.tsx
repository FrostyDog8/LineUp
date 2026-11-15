import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { GeneralSettingsForm } from "@/components/general-settings-form";
import { RanksSettings } from "@/components/ranks-settings";
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

  const defaultMergeWeekday =
    activity.scheduleDefaults.registrationOpensWeekday ??
    activity.weeklyWeekday ??
    1;

  return (
    <DashboardShell
      title="Settings"
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
        <TransferOwnershipDialog
          activityId={id}
          candidates={transferCandidates}
          ranks={ranks}
          defaultRankId={activity.defaultRankId}
          compact
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
        <Card className="lg:col-span-3">
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

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ranks</CardTitle>
            <CardDescription>
              When each rank merges into the main list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RanksSettings
              activityId={id}
              timezone={activity.timezone}
              scheduleMode={activity.scheduleMode}
              defaultMergeWeekday={defaultMergeWeekday}
              ranks={ranks}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
