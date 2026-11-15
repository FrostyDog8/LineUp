import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateSettingsAction } from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { RanksSettings } from "@/components/ranks-settings";
import { RegistrationOpenControls } from "@/components/registration-open-controls";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { TransferOwnershipDialog } from "@/components/transfer-ownership-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionUser } from "@/lib/auth";
import { formatDateTimeLocal } from "@/lib/datetime";
import { WEEKDAY_OPTIONS, weekdayLabel } from "@/lib/schedule-defaults";
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
  const boundUpdate = updateSettingsAction.bind(null, id);

  const scheduleSummary =
    activity.scheduleMode === "weekly"
      ? `Weekly · ${weekdayLabel(activity.weeklyWeekday)}${activity.weeklyTime ? ` ${activity.weeklyTime}` : ""}`
      : activity.scheduleMode === "one_time"
        ? "One-time"
        : "Custom";

  const regAtLocal = activity.scheduleDefaults.registrationOpensAt
    ? formatDateTimeLocal(
        new Date(activity.scheduleDefaults.registrationOpensAt),
        activity.timezone,
      )
    : "";

  return (
    <DashboardShell
      title="Settings"
      subtitle={activity.name}
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
      compact
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}`}>Back to activity</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/activities/${id}/members`}>Members</Link>
        </Button>
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
            <ActionForm action={boundUpdate} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={activity.name}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="defaultCapacity">Default capacity</Label>
                  <Input
                    id="defaultCapacity"
                    name="defaultCapacity"
                    type="number"
                    min={1}
                    defaultValue={activity.defaultCapacity}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="defaultPlace">Default place</Label>
                  <Input
                    id="defaultPlace"
                    name="defaultPlace"
                    defaultValue={activity.defaultPlace ?? ""}
                    placeholder="Venue or location"
                  />
                </div>
              </div>

              {activity.scheduleMode === "weekly" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="weeklyWeekday">Weekly day</Label>
                    <select
                      id="weeklyWeekday"
                      name="weeklyWeekday"
                      defaultValue={activity.weeklyWeekday ?? 3}
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      {WEEKDAY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="weeklyTime">Weekly time</Label>
                    <Input
                      id="weeklyTime"
                      name="weeklyTime"
                      type="time"
                      defaultValue={activity.weeklyTime ?? "19:00"}
                      required
                    />
                  </div>
                </div>
              ) : null}

              <RegistrationOpenControls
                activityId={id}
                scheduleMode={activity.scheduleMode}
                registrationOpensMode={
                  activity.scheduleDefaults.registrationOpensMode ??
                  "scheduled"
                }
                registrationOpensAtLocal={regAtLocal}
                registrationOpensWeekday={
                  activity.scheduleDefaults.registrationOpensWeekday ?? 1
                }
                registrationOpensTime={
                  activity.scheduleDefaults.registrationOpensTime ?? "12:00"
                }
                canOpenNow={access.canEditEvents}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Join mode</Label>
                  <SegmentedToggle
                    name="joinMode"
                    ariaLabel="Join mode"
                    defaultValue={activity.joinMode}
                    options={[
                      { value: "open", label: "Open" },
                      { value: "must_approve", label: "Approval required" },
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="defaultRankId">Default rank</Label>
                  <select
                    id="defaultRankId"
                    name="defaultRankId"
                    defaultValue={activity.defaultRankId ?? ""}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {ranks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{scheduleSummary}</p>
              <FormSubmitButton size="sm">Save settings</FormSubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ranks</CardTitle>
              <CardDescription>
                Rename ranks and choose when each merges into the main list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RanksSettings
                activityId={id}
                timezone={activity.timezone}
                ranks={ranks}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ownership</CardTitle>
              <CardDescription>
                Transfer this activity to another member.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransferOwnershipDialog
                activityId={id}
                candidates={transferCandidates}
                ranks={ranks}
                defaultRankId={activity.defaultRankId}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
