import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OccurrenceEventNav } from "@/components/occurrence-event-nav";
import {
  OccurrenceEventHeader,
  OccurrenceLinePanel,
} from "@/components/occurrence-line";
import { getSessionUser } from "@/lib/auth";
import { loadOccurrencePageData } from "@/server/occurrence-page";

export const instant = false;

type Props = {
  params: Promise<{ id: string; occurrenceId: string }>;
};

export default async function OccurrenceLinePage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id, occurrenceId } = await params;
  const result = await loadOccurrencePageData(id, occurrenceId, user.id);
  if (!result.ok) {
    if (result.reason === "forbidden") redirect("/dashboard");
    notFound();
  }

  const { activity, access, clientView } = result.data;

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
        active="line"
        showMerge={clientView.canMergeRanks}
        showSettings={clientView.canEditSettings}
      />

      {access.status === "requested" ? (
        <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Your join request is pending — you can view the line but cannot
          register yet.
        </p>
      ) : null}

      <OccurrenceEventHeader
        view={clientView}
        timezone={activity.timezone}
      />
      <OccurrenceLinePanel view={clientView} />
    </DashboardShell>
  );
}
