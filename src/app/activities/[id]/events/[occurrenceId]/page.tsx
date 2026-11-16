import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  OccurrenceLine,
  type OccurrenceLineView,
} from "@/components/occurrence-line";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { getActivityById } from "@/server/activities";
import { getActivityAccess } from "@/server/permissions";
import { getOccurrenceRegistrationView } from "@/server/registration";

export const instant = false;

type Props = {
  params: Promise<{ id: string; occurrenceId: string }>;
};

function serializeEntry(
  e: NonNullable<
    Awaited<ReturnType<typeof getOccurrenceRegistrationView>>
  >["main"][number],
) {
  return {
    ...e,
    registeredAt: e.registeredAt.toISOString(),
  };
}

export default async function OccurrencePage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id, occurrenceId } = await params;
  const activity = await getActivityById(id);
  if (!activity) notFound();

  const access = await getActivityAccess(id, user.id);
  if (!access || (access.status !== "active" && access.status !== "requested")) {
    redirect("/dashboard");
  }

  const view = await getOccurrenceRegistrationView(id, occurrenceId, user.id);
  if (!view) notFound();

  const clientView: OccurrenceLineView = {
    occurrenceId: view.occurrenceId,
    activityId: view.activityId,
    startsAt: view.startsAt.toISOString(),
    status: view.status,
    effectiveCapacity: view.effectiveCapacity,
    capacityOverride: view.capacityOverride,
    place: view.place,
    subHeadline: view.subHeadline,
    main: view.main.map(serializeEntry),
    wait: view.wait.map(serializeEntry),
    yourEntry: view.yourEntry ? serializeEntry(view.yourEntry) : null,
    yourExplanation: view.yourExplanation,
    canRegister: view.canRegister,
    canCancel: view.canCancel,
    canEditCapacity: view.canEditCapacity,
    canMergeRanks: view.canMergeRanks,
    canOpenRegistration: view.canOpenRegistration,
    pendingMerges: view.pendingMerges.map((m) => ({
      ...m,
      mergeAt: m.mergeAt ? m.mergeAt.toISOString() : null,
    })),
    registrationOpensAt: view.registrationOpensAt
      ? view.registrationOpensAt.toISOString()
      : null,
  };

  return (
    <DashboardShell
      title={null}
      subtitle={null}
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
      compact
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/activities/${id}`}>← Events</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}/members`}>Members</Link>
        </Button>
      </div>

      {access.status === "requested" ? (
        <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Your join request is pending — you can view the line but cannot
          register yet.
        </p>
      ) : null}

      <OccurrenceLine
        view={clientView}
        timezone={activity.timezone}
        defaultCapacity={activity.defaultCapacity}
      />
    </DashboardShell>
  );
}
