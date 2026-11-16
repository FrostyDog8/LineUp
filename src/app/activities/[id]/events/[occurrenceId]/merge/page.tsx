import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OccurrenceEventNav } from "@/components/occurrence-event-nav";
import {
  OccurrenceEventHeader,
  OccurrenceMergePanel,
} from "@/components/occurrence-line";
import { getSessionUser } from "@/lib/auth";
import { loadOccurrencePageData } from "@/server/occurrence-page";

export const instant = false;

type Props = {
  params: Promise<{ id: string; occurrenceId: string }>;
};

export default async function OccurrenceMergePage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id, occurrenceId } = await params;
  const result = await loadOccurrencePageData(id, occurrenceId, user.id);
  if (!result.ok) {
    if (result.reason === "forbidden") redirect("/dashboard");
    notFound();
  }

  const { activity, clientView } = result.data;
  if (!clientView.canMergeRanks) {
    redirect(`/activities/${id}/events/${occurrenceId}`);
  }

  return (
    <DashboardShell
      title={null}
      subtitle={null}
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
      compact
    >
      <OccurrenceEventNav
        activityId={id}
        occurrenceId={occurrenceId}
        active="merge"
        showMerge
        showSettings={clientView.canEditSettings}
      />

      <OccurrenceEventHeader
        view={clientView}
        timezone={activity.timezone}
      />
      <OccurrenceMergePanel
        view={clientView}
        timezone={activity.timezone}
      />
    </DashboardShell>
  );
}
