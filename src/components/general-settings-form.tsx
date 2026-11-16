"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingsAction } from "@/app/actions/activities";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAY_OPTIONS } from "@/lib/schedule-defaults";

type RankOption = { id: string; name: string };

type Props = {
  activityId: string;
  name: string;
  defaultCapacity: number;
  defaultPlace: string | null;
  scheduleMode: "one_time" | "weekly" | "custom";
  weeklyWeekday: number | null;
  weeklyTime: string | null;
  joinMode: "open" | "must_approve";
  defaultRankId: string | null;
  ranks: RankOption[];
};

export function GeneralSettingsForm({
  activityId,
  name,
  defaultCapacity,
  defaultPlace,
  scheduleMode,
  weeklyWeekday,
  weeklyTime,
  joinMode,
  defaultRankId,
  ranks,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (overrides?: Record<string, string>) => {
      const form = formRef.current;
      if (!form) return;
      setSaving(true);
      setError(null);
      try {
        const fd = new FormData(form);
        if (overrides) {
          for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
        }
        const result = await updateSettingsAction(activityId, null, fd);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [activityId, router],
  );

  const scheduleSave = useCallback(
    (overrides?: Record<string, string>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void save(overrides);
      }, 400);
    },
    [save],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onChange={() => scheduleSave()}
      onBlur={(e) => {
        if (!formRef.current?.contains(e.relatedTarget as Node | null)) {
          if (timerRef.current) clearTimeout(timerRef.current);
          void save();
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="defaultCapacity">Default spots</Label>
          <Input
            id="defaultCapacity"
            name="defaultCapacity"
            type="number"
            min={1}
            defaultValue={defaultCapacity}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="defaultPlace">Default place</Label>
          <Input
            id="defaultPlace"
            name="defaultPlace"
            defaultValue={defaultPlace ?? ""}
            placeholder="Venue or location"
          />
        </div>
      </div>

      {scheduleMode === "weekly" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="weeklyWeekday">Weekly day</Label>
            <select
              id="weeklyWeekday"
              name="weeklyWeekday"
              defaultValue={weeklyWeekday ?? 3}
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
              defaultValue={weeklyTime ?? "19:00"}
              required
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label>Join mode</Label>
        <SegmentedToggle
          name="joinMode"
          ariaLabel="Join mode"
          defaultValue={joinMode}
          onValueChange={(value) => scheduleSave({ joinMode: value })}
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
          defaultValue={defaultRankId ?? ""}
          className="flex h-10 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm"
        >
          {ranks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : saving ? (
        <p className="text-xs text-muted-foreground">Saving…</p>
      ) : null}
    </form>
  );
}
