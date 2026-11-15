"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRankAction,
  deleteRankAction,
  updateRankAction,
} from "@/app/actions/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeLocal, zonedParts } from "@/lib/datetime";
import { WEEKDAY_OPTIONS } from "@/lib/schedule-defaults";
import type { RankRow } from "@/server/ranks";

type Props = {
  activityId: string;
  timezone: string;
  scheduleMode: "one_time" | "weekly" | "custom";
  defaultMergeWeekday: number;
  ranks: RankRow[];
};

export function RanksSettings({
  activityId,
  timezone,
  scheduleMode,
  defaultMergeWeekday,
  ranks,
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onNewRank() {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createRankAction(activityId);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(rankId: string) {
    setDeleteError(null);
    const result = await deleteRankAction(activityId, rankId, null);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {ranks.map((rank) => (
          <RankRowEditor
            key={rank.id}
            activityId={activityId}
            timezone={timezone}
            scheduleMode={scheduleMode}
            defaultMergeWeekday={defaultMergeWeekday}
            rank={rank}
            canDelete={ranks.length > 1}
            onDelete={() => void onDelete(rank.id)}
          />
        ))}
      </ul>

      {deleteError ? (
        <p className="text-sm text-red-700" role="alert">
          {deleteError}
        </p>
      ) : null}

      <div className="pt-1">
        <Button
          type="button"
          size="sm"
          disabled={creating}
          onClick={() => void onNewRank()}
        >
          {creating ? "Adding…" : "New rank"}
        </Button>
        {createError ? (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {createError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RankRowEditor({
  activityId,
  timezone,
  scheduleMode,
  defaultMergeWeekday,
  rank,
  canDelete,
  onDelete,
}: {
  activityId: string;
  timezone: string;
  scheduleMode: "one_time" | "weekly" | "custom";
  defaultMergeWeekday: number;
  rank: RankRow;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekly = scheduleMode === "weekly";
  const fromAt = rank.mergeAt ? zonedParts(new Date(rank.mergeAt), timezone) : null;
  const initialWeekday =
    rank.mergeWeekday ?? fromAt?.weekday ?? defaultMergeWeekday;
  const initialTime =
    rank.mergeTime ??
    (fromAt
      ? `${String(fromAt.hour).padStart(2, "0")}:${String(fromAt.minute).padStart(2, "0")}`
      : "12:00");

  const [mode, setMode] = useState<"from_open" | "manual" | "scheduled">(
    rank.mergeMode,
  );
  const [error, setError] = useState<string | null>(null);
  const modeInitRef = useRef(true);

  const save = useCallback(
    async (overrideMode?: "from_open" | "manual" | "scheduled") => {
      const form = formRef.current;
      if (!form) return;
      setError(null);
      const fd = new FormData(form);
      if (overrideMode) fd.set("mergeMode", overrideMode);
      const result = await updateRankAction(activityId, rank.id, null, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    },
    [activityId, rank.id, router],
  );

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, 400);
  }, [save]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (modeInitRef.current) {
      modeInitRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      void save(mode);
    }, 0);
    return () => clearTimeout(t);
  }, [mode, save]);

  function setMergeMode(next: "from_open" | "manual" | "scheduled") {
    if (next === mode) return;
    setMode(next);
  }

  return (
    <li className="rounded-lg border border-border px-2 py-1.5">
      <form
        ref={formRef}
        className="space-y-1.5"
        onChange={scheduleSave}
        onBlur={(e) => {
          if (!formRef.current?.contains(e.relatedTarget as Node | null)) {
            if (timerRef.current) clearTimeout(timerRef.current);
            void save();
          }
        }}
      >
        <div className="flex items-center gap-1.5">
          <Input
            name="name"
            defaultValue={rank.name}
            required
            aria-label="Rank name"
            className="h-8 flex-1"
          />
          {canDelete ? (
            <button
              type="button"
              className="shrink-0 px-1.5 text-xs text-red-700 underline-offset-2 hover:underline"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : (
            <span
              className="shrink-0 text-[10px] text-muted-foreground"
              title="Cannot delete the only remaining rank"
            >
              Only rank
            </span>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          When this rank joins the main list
        </p>
        <input type="hidden" name="mergeMode" value={mode} />
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/50 p-0.5">
          {(
            [
              { value: "from_open" as const, label: "From open" },
              {
                value: "scheduled" as const,
                label: weekly ? "Day & time" : "Date & time",
              },
              { value: "manual" as const, label: "Merge now" },
            ] as const
          ).map((opt) => {
            const selected = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setMergeMode(opt.value)}
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
          weekly ? (
            <div className="grid grid-cols-2 gap-1.5">
              <select
                name="mergeWeekday"
                defaultValue={initialWeekday}
                aria-label="Merge day"
                className="flex h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
              >
                {WEEKDAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <Input
                name="mergeTime"
                type="time"
                defaultValue={initialTime}
                required
                aria-label="Merge time"
                className="h-8"
              />
            </div>
          ) : (
            <Input
              name="mergeAt"
              type="datetime-local"
              required
              aria-label="Merge at"
              className="h-8"
              defaultValue={
                rank.mergeAt
                  ? formatDateTimeLocal(new Date(rank.mergeAt), timezone)
                  : ""
              }
            />
          )
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
