"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelRegistrationAction,
  mergeRankNowAction,
  openRegistrationFromEventAction,
  registerForOccurrenceAction,
  setOccurrenceEventSettingsAction,
  setOccurrenceRankMergeOverrideAction,
} from "@/app/actions/registration";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTimeLocal, formatEventWhen } from "@/lib/datetime";

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

export type OccurrenceRankMergeSettingView = {
  rankId: string;
  rankName: string;
  mergeMode: "from_open" | "manual" | "scheduled";
  mergeAt: string | null;
  activityMergeMode: "from_open" | "manual" | "scheduled";
  activityMergeAt: string | null;
  overridden: boolean;
  merged: boolean;
  due: boolean;
};

export type OccurrenceLineView = {
  occurrenceId: string;
  activityId: string;
  startsAt: string;
  status: "scheduled" | "registration_open" | "closed" | "cancelled";
  effectiveCapacity: number;
  capacityOverride: number | null;
  place: string | null;
  placeOverride: string | null;
  defaultPlace: string | null;
  subHeadline: string | null;
  main: OccurrenceLineEntry[];
  wait: OccurrenceLineEntry[];
  yourEntry: OccurrenceLineEntry | null;
  yourExplanation: string | null;
  canRegister: boolean;
  canCancel: boolean;
  canEditSettings: boolean;
  canMergeRanks: boolean;
  canOpenRegistration: boolean;
  pendingMerges: Array<{
    rankId: string;
    rankName: string;
    mergeMode: "from_open" | "manual" | "scheduled";
    mergeAt: string | null;
    due: boolean;
  }>;
  rankMergeSettings: OccurrenceRankMergeSettingView[];
  registrationOpensAt: string | null;
  registrationOpensOverride: string | null;
  defaultRegistrationOpensAt: string | null;
};

type SharedProps = {
  view: OccurrenceLineView;
  timezone: string;
};

function modeLabel(mode: "from_open" | "manual" | "scheduled"): string {
  if (mode === "from_open") return "From open";
  if (mode === "manual") return "Manual merge";
  return "Date & time";
}

function useActionFeedback() {
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

  return { busy, message, error, run };
}

function Feedback({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
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
    </>
  );
}

/** Single page headline — event when + status meta. */
export function OccurrenceEventHeader({ view, timezone }: SharedProps) {
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
    <header className="mb-4 space-y-1">
      <p className="text-sm text-muted-foreground">{statusLabel}</p>
      <h1 className="font-display text-2xl tracking-tight text-foreground">
        {formatEventWhen(startsAt, timezone)}
      </h1>
      {view.subHeadline ? (
        <p className="text-foreground/90">{view.subHeadline}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Spots {view.effectiveCapacity}
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
  );
}

export function OccurrenceLinePanel({ view }: { view: OccurrenceLineView }) {
  const { busy, message, error, run } = useActionFeedback();

  return (
    <div className="space-y-3">
      <Feedback error={error} message={message} />

      {view.yourExplanation ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground">
          {view.yourExplanation}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <LineSection
          title="Main list"
          entries={view.main}
          empty="No one on main yet."
        />
        <LineSection
          title="Wait line"
          entries={view.wait}
          empty="Wait line is empty."
        />
      </div>
    </div>
  );
}

export function OccurrenceMergePanel({
  view,
  timezone,
}: SharedProps) {
  const { busy, message, error, run } = useActionFeedback();

  return (
    <div className="space-y-3">
      <Feedback error={error} message={message} />
      <p className="text-xs text-muted-foreground">
        Manual merge and per-rank timing for this event only. Activity defaults
        apply unless overridden.
      </p>

      {view.pendingMerges.length > 0 ? (
        <ul className="space-y-1.5">
          {view.pendingMerges.map((m) => (
            <li
              key={m.rankId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
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
      ) : (
        <p className="text-sm text-muted-foreground">
          All ranks are already merged for this event.
        </p>
      )}

      <ul className="space-y-2">
        {view.rankMergeSettings.map((rank) => (
          <RankMergeOverrideRow
            key={rank.rankId}
            view={view}
            rank={rank}
            timezone={timezone}
          />
        ))}
      </ul>
    </div>
  );
}

export function OccurrenceSettingsPanel({
  view,
  timezone,
  defaultCapacity,
}: SharedProps & { defaultCapacity: number }) {
  const { busy, message, error, run } = useActionFeedback();

  return (
    <div className="space-y-3">
      <Feedback error={error} message={message} />
      <p className="text-xs text-muted-foreground">
        Override sub-headline, place, spots, and registration open for this
        event.
      </p>
      <EventSettingsForm
        view={view}
        timezone={timezone}
        defaultCapacity={defaultCapacity}
        busy={busy}
        onOpen={() =>
          void run("open", () =>
            openRegistrationFromEventAction(
              view.activityId,
              view.occurrenceId,
            ),
          )
        }
      />
    </div>
  );
}

function EventSettingsForm({
  view,
  timezone,
  defaultCapacity,
  busy,
  onOpen,
}: {
  view: OccurrenceLineView;
  timezone: string;
  defaultCapacity: number;
  busy: string | null;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [overrideOpen, setOverrideOpen] = useState(
    Boolean(view.registrationOpensOverride),
  );

  useEffect(() => {
    setOverrideOpen(Boolean(view.registrationOpensOverride));
  }, [view.registrationOpensOverride]);

  return (
    <ActionForm
      action={async (prev, formData) => {
        formData.set("overrideRegistrationOpen", overrideOpen ? "1" : "0");
        const result = await setOccurrenceEventSettingsAction(
          view.activityId,
          view.occurrenceId,
          prev,
          formData,
        );
        if (result.ok) router.refresh();
        return result;
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
    >
      <div className="space-y-1 sm:col-span-2 lg:col-span-4">
        <Label htmlFor="event-subHeadline">Sub-headline</Label>
        <Input
          id="event-subHeadline"
          name="subHeadline"
          className="h-8"
          placeholder="Optional — e.g. Courts 1–2"
          maxLength={120}
          defaultValue={view.subHeadline ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="event-place">Place</Label>
        <Input
          id="event-place"
          name="place"
          className="h-8"
          placeholder={
            view.defaultPlace
              ? `Default: ${view.defaultPlace}`
              : "Activity default if blank"
          }
          defaultValue={view.placeOverride ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="event-capacity">Spots</Label>
        <Input
          id="event-capacity"
          name="capacity"
          type="number"
          min={1}
          className="h-8"
          placeholder={`Default ${defaultCapacity}`}
          defaultValue={view.capacityOverride?.toString() ?? ""}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="event-reg-open">Registration open</Label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={overrideOpen}
              onChange={(e) => setOverrideOpen(e.target.checked)}
              className="size-3.5"
            />
            Override default
          </label>
        </div>
        {overrideOpen ? (
          <Input
            id="event-reg-open"
            name="registrationOpensAt"
            type="datetime-local"
            className="h-8"
            required
            defaultValue={
              view.registrationOpensOverride
                ? formatDateTimeLocal(
                    new Date(view.registrationOpensOverride),
                    timezone,
                  )
                : view.defaultRegistrationOpensAt
                  ? formatDateTimeLocal(
                      new Date(view.defaultRegistrationOpensAt),
                      timezone,
                    )
                  : ""
            }
          />
        ) : (
          <p className="h-8 content-center text-xs text-muted-foreground">
            {view.defaultRegistrationOpensAt
              ? `Default ${formatEventWhen(new Date(view.defaultRegistrationOpensAt), timezone)}`
              : "Uses activity default (manual or scheduled)"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 lg:col-span-4">
        <FormSubmitButton size="sm" pendingLabel="Saving…">
          Save settings
        </FormSubmitButton>
        {view.canOpenRegistration ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === "open"}
            onClick={onOpen}
          >
            {busy === "open" ? "Opening…" : "Open registration"}
          </Button>
        ) : null}
      </div>
    </ActionForm>
  );
}

function RankMergeOverrideRow({
  view,
  rank,
  timezone,
}: {
  view: OccurrenceLineView;
  rank: OccurrenceRankMergeSettingView;
  timezone: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [useDefault, setUseDefault] = useState(!rank.overridden);
  const [mode, setMode] = useState(rank.mergeMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUseDefault(!rank.overridden);
    setMode(rank.mergeMode);
  }, [rank.overridden, rank.mergeMode, rank.rankId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function save(next?: {
    useDefault?: boolean;
    mergeMode?: "from_open" | "manual" | "scheduled";
  }) {
    const form = formRef.current;
    if (!form) return;
    setError(null);
    const fd = new FormData(form);
    const nextDefault = next?.useDefault ?? useDefault;
    const nextMode = next?.mergeMode ?? mode;
    fd.set("useDefault", nextDefault ? "1" : "0");
    fd.set("mergeMode", nextMode);
    const result = await setOccurrenceRankMergeOverrideAction(
      view.activityId,
      view.occurrenceId,
      rank.rankId,
      null,
      fd,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, 400);
  }

  return (
    <li className="rounded-lg border border-border px-2.5 py-2">
      <form
        ref={formRef}
        className="space-y-1.5"
        onChange={() => {
          if (!useDefault) scheduleSave();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {rank.rankName}
              {rank.merged ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  merged
                </span>
              ) : null}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Activity default: {modeLabel(rank.activityMergeMode)}
              {rank.activityMergeMode === "scheduled" && rank.activityMergeAt
                ? ` · ${formatEventWhen(new Date(rank.activityMergeAt), timezone)}`
                : ""}
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={!useDefault}
              onChange={(e) => {
                const override = e.target.checked;
                setUseDefault(!override);
                void save({
                  useDefault: !override,
                  mergeMode: override ? mode : undefined,
                });
              }}
              className="size-3.5"
            />
            Override for this event
          </label>
        </div>

        {!useDefault ? (
          <>
            <input type="hidden" name="mergeMode" value={mode} />
            <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/50 p-0.5">
              {(
                [
                  { value: "from_open" as const, label: "From open" },
                  { value: "scheduled" as const, label: "Date & time" },
                  { value: "manual" as const, label: "Manual merge" },
                ] as const
              ).map((opt) => {
                const selected = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={rank.merged}
                    onClick={() => {
                      if (opt.value === mode) return;
                      setMode(opt.value);
                      void save({ useDefault: false, mergeMode: opt.value });
                    }}
                    className={
                      selected
                        ? "rounded px-1.5 py-1 text-[11px] font-medium whitespace-nowrap text-foreground bg-card shadow-sm"
                        : "rounded px-1.5 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {mode === "scheduled" ? (
              <Input
                name="mergeAt"
                type="datetime-local"
                required
                disabled={rank.merged}
                aria-label={`${rank.rankName} merge at`}
                className="h-8"
                defaultValue={
                  rank.mergeAt
                    ? formatDateTimeLocal(new Date(rank.mergeAt), timezone)
                    : rank.activityMergeAt
                      ? formatDateTimeLocal(
                          new Date(rank.activityMergeAt),
                          timezone,
                        )
                      : ""
                }
              />
            ) : null}
          </>
        ) : null}
      </form>
      {error ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </li>
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
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">
        {title}{" "}
        <span className="font-normal text-muted-foreground">
          ({entries.length})
        </span>
      </h3>
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
    </div>
  );
}
