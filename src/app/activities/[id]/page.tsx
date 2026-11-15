import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { EventsPanel } from "@/components/events-panel";
import { InviteDialog } from "@/components/invite-dialog";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { weekdayLabel } from "@/lib/schedule-defaults";
import { getActivityById } from "@/server/activities";
import {
  ensureWeeklyOccurrences,
  listOccurrences,
} from "@/server/occurrences";
import { getActivityAccess } from "@/server/permissions";

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

  await ensureWeeklyOccurrences(id);
  const events = await listOccurrences(id);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  const inviteUrl = `${appUrl.replace(/\/$/, "")}/activities/join?code=${activity.inviteSlug}`;
  const scheduleLabel =
    activity.scheduleMode === "weekly"
      ? `weekly · ${weekdayLabel(activity.weeklyWeekday)}${activity.weeklyTime ? ` ${activity.weeklyTime}` : ""}`
      : activity.scheduleMode === "one_time"
        ? "one-time"
        : "custom";
  const joinLabel =
    activity.joinMode === "open" ? "open join" : "approval required";

  return (
    <DashboardShell
      title={activity.name}
      subtitle={`${scheduleLabel} · ${joinLabel}`}
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
      compact
    >
      {access.status === "requested" ? (
        <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Your join request is pending approval.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <InviteDialog
          inviteUrl={inviteUrl}
          inviteCode={activity.inviteSlug}
          activityName={activity.name}
        />
        {access.status === "active" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/activities/${id}/members`}>Members</Link>
          </Button>
        ) : null}
        {access.canManageSettings ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/activities/${id}/settings`}>Settings</Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      {access.status === "active" ? (
        <EventsPanel
          activityId={id}
          timezone={activity.timezone}
          defaultCapacity={activity.defaultCapacity}
          defaultPlace={activity.defaultPlace}
          scheduleMode={activity.scheduleMode}
          canEdit={access.canEditEvents}
          events={events.map((e) => ({
            id: e.id,
            startsAt: e.startsAt.toISOString(),
            capacity: e.capacity,
            place: e.place,
            status: e.status,
            subHeadline: e.subHeadline,
            notes: e.notes,
          }))}
        />
      ) : null}
    </DashboardShell>
  );
}
