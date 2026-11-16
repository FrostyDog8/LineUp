"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelRegistrationAction,
  mergeRankNowAction,
  openRegistrationFromEventAction,
  registerForOccurrenceAction,
  setOccurrenceCapacityAction,
} from "@/app/actions/registration";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEventWhen } from "@/lib/datetime";

export type OccurrenceLineEntry = {
  id: string;
  kind: "member" | "guest";
  userId: string | null;
  displayName: string;
  guestName: string | null;
  rankId: string | null;
  rankName: string | null;
  rankSortPriority: number;
  line: "main" | "wait";
  status: "registered" | "waitlisted" | "confirmed" | "cut" | "cancelled";
  position: number | null;
  registeredAt: string;
  isYou: boolean;
};

export type OccurrenceLineView = {
  occurrenceId: string;
  activityId: string;
  startsAt: string;
  status: "scheduled" | "registration_open" | "closed" | "cancelled";
  effectiveCapacity: number;
  capacityOverride: number | null;
  place: string | null;
  subHeadline: string | null;
  main: OccurrenceLineEntry[];
  wait: OccurrenceLineEntry[];
  yourEntry: OccurrenceLineEntry | null;
  yourExplanation: string | null;
  canRegister: boolean;
  canCancel: boolean;
  canEditCapacity: boolean;
  canMergeRanks: boolean;
  canOpenRegistration: boolean;
  pendingMerges: Array<{
    rankId: string;
    rankName: string;
    mergeMode: "from_open" | "manual" | "scheduled";
    mergeAt: string | null;
    due: boolean;
  }>;
  registrationOpensAt: string | null;
};

type Props = {
  view: OccurrenceLineView;
  timezone: string;
  defaultCapacity: number;
};

export function OccurrenceLine({ view, timezone, defaultCapacity }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    key: string,
    fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
  ) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Done.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const startsAt = new Date(view.startsAt);
  const statusLabel =
    view.status === "registration_open"
      ? "Registration open"
      : view.status === "scheduled"
        ? "Scheduled"
        : view.status === "closed"
          ? "Closed"
          : "Cancelled";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{statusLabel}</p>
        <h1 className="font-display text-2xl tracking-tight text-foreground">
          {formatEventWhen(startsAt, timezone)}
        </h1>
        {view.subHeadline ? (
          <p className="text-foreground/90">{view.subHeadline}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Capacity {view.effectiveCapacity}
          {view.place ? ` · ${view.place}` : ""}
          {view.main.length + view.wait.length > 0
            ? ` · ${view.main.length} main / ${view.wait.length} wait`
            : ""}
        </p>
        {view.registrationOpensAt && view.status === "scheduled" ? (
          <p className="text-xs text-muted-foreground">
            Opens {formatEventWhen(new Date(view.registrationOpensAt), timezone)}
          </p>
        ) : null}
      </header>

      {view.yourExplanation ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground">
          {view.yourExplanation}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-primary" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {view.canOpenRegistration ? (
          <Button
            type="button"
            size="sm"
            disabled={busy === "open"}
            onClick={() =>
              void run("open", () =>
                openRegistrationFromEventAction(
                  view.activityId,
                  view.occurrenceId,
                ),
              )
            }
          >
            {busy === "open" ? "Opening…" : "Open registration"}
          </Button>
        ) : null}
        {view.canRegister ? (
          <Button
            type="button"
            size="sm"
            disabled={busy === "register"}
            onClick={() =>
              void run("register", () =>
                registerForOccurrenceAction(
                  view.activityId,
                  view.occurrenceId,
                ),
              )
            }
          >
            {busy === "register" ? "Registering…" : "Register"}
          </Button>
        ) : null}
        {view.canCancel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === "cancel"}
            onClick={() =>
              void run("cancel", () =>
                cancelRegistrationAction(view.activityId, view.occurrenceId),
              )
            }
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel registration"}
          </Button>
        ) : null}
      </div>

      {view.canEditCapacity ? (
        <ActionForm
          action={async (prev, formData) => {
            const result = await setOccurrenceCapacityAction(
              view.activityId,
              view.occurrenceId,
              prev,
              formData,
            );
            if (result.ok) router.refresh();
            return result;
          }}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border px-3 py-2"
        >
          <div className="space-y-1">
            <Label htmlFor="capacity">Live capacity</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              className="h-8 w-28"
              placeholder={`Default ${defaultCapacity}`}
              defaultValue={view.capacityOverride?.toString() ?? ""}
            />
          </div>
          <FormSubmitButton size="sm" pendingLabel="Saving…">
            Update
          </FormSubmitButton>
          <p className="basis-full text-xs text-muted-foreground">
            Blank uses activity default ({defaultCapacity}). Changing N
            rebalances main / wait and can auto-promote.
          </p>
        </ActionForm>
      ) : null}

      {view.canMergeRanks && view.pendingMerges.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-display text-lg tracking-tight">Pending merges</h2>
          <ul className="space-y-2">
            {view.pendingMerges.map((m) => (
              <li
                key={m.rankId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{m.rankName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.mergeMode === "from_open"
                      ? "From open (pending apply)"
                      : m.mergeMode === "scheduled"
                        ? m.mergeAt
                          ? `Scheduled ${formatEventWhen(new Date(m.mergeAt), timezone)}${m.due ? " · due" : ""}`
                          : "Scheduled (time missing)"
                        : "Manual merge"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === `merge-${m.rankId}`}
                  onClick={() =>
                    void run(`merge-${m.rankId}`, () =>
                      mergeRankNowAction(
                        view.activityId,
                        view.occurrenceId,
                        m.rankId,
                      ),
                    )
                  }
                >
                  {busy === `merge-${m.rankId}` ? "Merging…" : "Manual merge"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <LineSection title="Main list" entries={view.main} empty="No one on main yet." />
      <LineSection
        title="Wait line"
        entries={view.wait}
        empty="Wait line is empty."
      />
    </div>
  );
}

function LineSection({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: OccurrenceLineEntry[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg tracking-tight">
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({entries.length})
        </span>
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              className={
                e.isYou
                  ? "flex items-baseline justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
                  : "flex items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              }
            >
              <div className="min-w-0">
                <span className="mr-2 tabular-nums text-muted-foreground">
                  {e.position ?? "—"}
                </span>
                <span className="font-medium">
                  {e.displayName}
                  {e.isYou ? " (you)" : ""}
                </span>
                {e.rankName ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {e.rankName}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {e.status}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
