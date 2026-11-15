import {
  approveJoinAction,
  assignRankAction,
  promoteManagerAction,
  rejectJoinAction,
  saveManagerTogglesAction,
} from "@/app/actions/activities";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { MemberRow } from "@/server/memberships";
import type { RankRow } from "@/server/ranks";
import type { ActivityAccess } from "@/server/permissions";

function memberLabel(m: MemberRow) {
  return m.displayName || m.phone;
}

export function JoinRequestsPanel({
  activityId,
  requests,
  ranks,
  access,
  defaultRankId,
}: {
  activityId: string;
  requests: MemberRow[];
  ranks: RankRow[];
  access: ActivityAccess;
  defaultRankId: string | null;
}) {
  if (!access.canApproveJoins) return null;
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending join requests.</p>
    );
  }

  const fallbackRank =
    defaultRankId ?? ranks.find((r) => r.isDefault)?.id ?? ranks[0]?.id ?? "";

  return (
    <ul className="space-y-4">
      {requests.map((req) => (
        <li
          key={req.membershipId}
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{memberLabel(req)}</p>
              <p className="text-xs text-muted-foreground">{req.phone}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                action={approveJoinAction.bind(
                  null,
                  activityId,
                  req.membershipId,
                )}
                className="flex flex-wrap items-center gap-2"
              >
                <select
                  name="rankId"
                  defaultValue={fallbackRank}
                  className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                >
                  {ranks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <FormSubmitButton size="sm" pendingLabel="…">
                  Approve
                </FormSubmitButton>
              </form>
              <form
                action={rejectJoinAction.bind(
                  null,
                  activityId,
                  req.membershipId,
                )}
              >
                <FormSubmitButton
                  size="sm"
                  variant="outline"
                  pendingLabel="…"
                >
                  Reject
                </FormSubmitButton>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MembersPanel({
  activityId,
  members,
  ranks,
  access,
}: {
  activityId: string;
  members: MemberRow[];
  ranks: RankRow[];
  access: ActivityAccess;
}) {
  const active = members.filter((m) => m.status === "active");

  return (
    <ul className="space-y-3">
      {active.map((m) => (
        <li
          key={m.membershipId}
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{memberLabel(m)}</p>
              <p className="text-xs text-muted-foreground">
                {m.role}
                {m.rankName ? ` · ${m.rankName}` : ""} · {m.phone}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              {access.canChangeRanks && m.role !== "owner" ? (
                <form
                  action={assignRankAction.bind(
                    null,
                    activityId,
                    m.membershipId,
                  )}
                  className="flex items-center gap-2"
                >
                  <select
                    name="rankId"
                    defaultValue={m.rankId ?? ""}
                    className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                  >
                    {ranks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <FormSubmitButton size="sm" variant="outline" pendingLabel="…">
                    Set rank
                  </FormSubmitButton>
                </form>
              ) : null}

              {access.canPromoteManagers && m.role !== "owner" ? (
                m.role === "manager" ? (
                  <div className="space-y-2 text-sm">
                    <form
                      action={saveManagerTogglesAction.bind(
                        null,
                        activityId,
                        m.membershipId,
                      )}
                      className="grid gap-1 sm:grid-cols-2"
                    >
                      {(
                        [
                          ["approveJoins", "Approve joins"],
                          ["changeRanks", "Change ranks"],
                          ["editLists", "Edit lists"],
                          ["proxyConfirm", "Proxy confirm"],
                          ["addGuests", "Add guests"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name={key}
                            defaultChecked={Boolean(m.permissions?.[key])}
                          />
                          {label}
                        </label>
                      ))}
                      <div className="sm:col-span-2 flex gap-2 pt-1">
                        <FormSubmitButton size="sm" pendingLabel="…">
                          Save toggles
                        </FormSubmitButton>
                      </div>
                    </form>
                    <form
                      action={promoteManagerAction.bind(
                        null,
                        activityId,
                        m.membershipId,
                      )}
                    >
                      <input type="hidden" name="enabled" value="false" />
                      <FormSubmitButton
                        size="sm"
                        variant="ghost"
                        pendingLabel="…"
                      >
                        Remove manager
                      </FormSubmitButton>
                    </form>
                  </div>
                ) : (
                  <form
                    action={promoteManagerAction.bind(
                      null,
                      activityId,
                      m.membershipId,
                    )}
                    className="space-y-2 text-sm"
                  >
                    <input type="hidden" name="enabled" value="true" />
                    <div className="grid gap-1 sm:grid-cols-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="approveJoins"
                          defaultChecked
                        />
                        Approve joins
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="changeRanks"
                          defaultChecked
                        />
                        Change ranks
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="editLists" />
                        Edit lists
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="proxyConfirm" />
                        Proxy confirm
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="addGuests" />
                        Add guests
                      </label>
                    </div>
                    <FormSubmitButton size="sm" pendingLabel="…">
                      Make manager
                    </FormSubmitButton>
                  </form>
                )
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
