import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  createRankAction,
  deleteRankAction,
  transferOwnershipAction,
  updateRankAction,
  updateSettingsAction,
} from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SegmentedToggle } from "@/components/segmented-toggle";
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
  const activeMembers = members.filter(
    (m) => m.status === "active" && m.userId !== user.id,
  );
  const boundUpdate = updateSettingsAction.bind(null, id);
  const boundTransfer = transferOwnershipAction.bind(null, id);
  const boundCreateRank = createRankAction.bind(null, id);

  const scheduleSummary =
    activity.scheduleMode === "weekly"
      ? `Weekly · ${weekdayLabel(activity.weeklyWeekday)}${activity.weeklyTime ? ` ${activity.weeklyTime}` : ""}`
      : activity.scheduleMode === "one_time"
        ? "One-time"
        : "Custom";

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
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Registration opens</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        id="registrationOpensWeekday"
                        name="registrationOpensWeekday"
                        defaultValue={
                          activity.scheduleDefaults.registrationOpensWeekday ??
                          1
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                        required
                      >
                        {WEEKDAY_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        id="registrationOpensTime"
                        name="registrationOpensTime"
                        type="time"
                        defaultValue={
                          activity.scheduleDefaults.registrationOpensTime ??
                          "12:00"
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="registrationOpensAt">Registration opens</Label>
                  <Input
                    id="registrationOpensAt"
                    name="registrationOpensAt"
                    type="datetime-local"
                    defaultValue={
                      activity.scheduleDefaults.registrationOpensAt
                        ? formatDateTimeLocal(
                            new Date(
                              activity.scheduleDefaults.registrationOpensAt,
                            ),
                            activity.timezone,
                          )
                        : ""
                    }
                    required
                  />
                </div>
              )}

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
              <CardDescription>Create, rename, reorder, delete.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {ranks.map((rank) => (
                  <li
                    key={rank.id}
                    className="rounded-lg border border-border px-2.5 py-2"
                  >
                    <form
                      action={updateRankAction.bind(null, id, rank.id)}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <div className="min-w-[8rem] flex-1 space-y-1">
                        <Label htmlFor={`rank-name-${rank.id}`}>Name</Label>
                        <Input
                          id={`rank-name-${rank.id}`}
                          name="name"
                          defaultValue={rank.name}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`rank-pri-${rank.id}`}>Priority</Label>
                        <Input
                          id={`rank-pri-${rank.id}`}
                          name="sortPriority"
                          type="number"
                          defaultValue={rank.sortPriority}
                          className="w-20"
                        />
                      </div>
                      <FormSubmitButton
                        size="sm"
                        variant="outline"
                        pendingLabel="…"
                      >
                        Save
                      </FormSubmitButton>
                    </form>
                    {ranks.length <= 1 ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Cannot delete the only remaining rank.
                      </p>
                    ) : (
                      <ActionForm
                        action={deleteRankAction.bind(null, id, rank.id)}
                        className="mt-1"
                      >
                        <FormSubmitButton
                          size="sm"
                          variant="ghost"
                          pendingLabel="…"
                        >
                          Delete{rank.isDefault ? " (default)" : ""}
                        </FormSubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>

              <ActionForm
                action={boundCreateRank}
                className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
              >
                <div className="min-w-[8rem] flex-1 space-y-1">
                  <Label htmlFor="new-rank-name">New rank</Label>
                  <Input
                    id="new-rank-name"
                    name="name"
                    placeholder="Substitute"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-rank-pri">Priority</Label>
                  <Input
                    id="new-rank-pri"
                    name="sortPriority"
                    type="number"
                    defaultValue={100}
                    className="w-20"
                  />
                </div>
                <FormSubmitButton size="sm" pendingLabel="…">
                  Add
                </FormSubmitButton>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Transfer ownership</CardTitle>
              <CardDescription>
                Pick a new owner; choose your rank afterward.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Invite and approve another member before transferring.
                </p>
              ) : (
                <ActionForm action={boundTransfer} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="newOwnerUserId">New owner</Label>
                    <select
                      id="newOwnerUserId"
                      name="newOwnerUserId"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select member
                      </option>
                      {activeMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName || m.phone} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="outgoingOwnerRankId">Your new rank</Label>
                    <select
                      id="outgoingOwnerRankId"
                      name="outgoingOwnerRankId"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                      defaultValue={
                        activity.defaultRankId ?? ranks[0]?.id ?? ""
                      }
                    >
                      {ranks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FormSubmitButton size="sm" variant="secondary">
                    Transfer ownership
                  </FormSubmitButton>
                </ActionForm>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
