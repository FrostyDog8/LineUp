import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  JoinRequestsPanel,
  MembersPanel,
} from "@/components/member-actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

export default async function ActivityMembersPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const activity = await getActivityById(id);
  if (!activity) notFound();

  const access = await getActivityAccess(id, user.id);
  if (!access || access.status !== "active") {
    redirect(`/activities/${id}`);
  }

  const [members, ranks] = await Promise.all([
    listMembers(id),
    listRanks(id),
  ]);
  const requests = members.filter((m) => m.status === "requested");

  return (
    <DashboardShell
      title="Members"
      subtitle={null}
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
      compact
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}`}>Back to activity</Link>
        </Button>
        {access.canManageSettings ? (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/activities/${id}/ranks`}>Ranks</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/activities/${id}/settings`}>Default settings</Link>
            </Button>
          </>
        ) : null}
      </div>

      {access.canApproveJoins ? (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Join requests</CardTitle>
          </CardHeader>
          <CardContent>
            <JoinRequestsPanel
              activityId={id}
              requests={requests}
              ranks={ranks}
              access={access}
              defaultRankId={activity.defaultRankId}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-4">
          <MembersPanel
            activityId={id}
            members={members}
            ranks={ranks}
            access={access}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
