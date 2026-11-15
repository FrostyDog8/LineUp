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

export default async function ActivityPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const activity = await getActivityById(id);
  if (!activity) notFound();

  const access = await getActivityAccess(id, user.id);
  if (!access || (access.status !== "active" && access.status !== "requested")) {
    redirect("/dashboard");
  }

  const [members, ranks] = await Promise.all([
    listMembers(id),
    listRanks(id),
  ]);
  const requests = members.filter((m) => m.status === "requested");
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  const inviteUrl = `${appUrl.replace(/\/$/, "")}/activities/join?code=${activity.inviteSlug}`;

  return (
    <DashboardShell
      title={activity.name}
      subtitle={`${activity.typeText || "Activity"} · ${activity.joinMode === "open" ? "open join" : "must approve"} · ${activity.timezone}`}
      userLabel={user.displayName || user.phone}
    >
      {access.status === "requested" ? (
        <p className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Your join request is pending approval.
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3">
        {access.canManageSettings ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/activities/${id}/settings`}>Settings</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invite</CardTitle>
            <CardDescription>
              Share this code or link. Capacity default: {activity.defaultCapacity}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Code:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                {activity.inviteSlug}
              </code>
            </p>
            <p className="break-all">
              <span className="text-muted-foreground">Link:</span> {inviteUrl}
            </p>
            <p>
              <span className="text-muted-foreground">Your role:</span>{" "}
              {access.role}
            </p>
          </CardContent>
        </Card>

        {access.canApproveJoins ? (
          <Card>
            <CardHeader>
              <CardTitle>Join requests</CardTitle>
              <CardDescription>
                Approve and set rank (default offered).
              </CardDescription>
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
      </div>

      {access.status === "active" ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Active members
              {access.canChangeRanks || access.canPromoteManagers
                ? " — manage ranks and managers below"
                : ""}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersPanel
              activityId={id}
              members={members}
              ranks={ranks}
              access={access}
            />
          </CardContent>
        </Card>
      ) : null}
    </DashboardShell>
  );
}
