"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { openRegistrationNowAction } from "@/app/actions/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAY_OPTIONS } from "@/lib/schedule-defaults";

type Props = {
  activityId: string;
  scheduleMode: "one_time" | "weekly" | "custom";
  registrationOpensMode: "scheduled" | "manual";
  registrationOpensAtLocal: string;
  registrationOpensWeekday: number;
  registrationOpensTime: string;
  canOpenNow: boolean;
};

export function RegistrationOpenControls({
  activityId,
  scheduleMode,
  registrationOpensMode,
  registrationOpensAtLocal,
  registrationOpensWeekday,
  registrationOpensTime,
  canOpenNow,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"scheduled" | "manual">(
    registrationOpensMode,
  );
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openNow() {
    setOpening(true);
    setMessage(null);
    try {
      const result = await openRegistrationNowAction(activityId);
      setMessage(result.ok ? (result.message ?? "Done.") : result.error);
      if (result.ok) router.refresh();
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>Registration opens</Label>
      <input type="hidden" name="registrationOpensMode" value={mode} />
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {(
          [
            { value: "scheduled" as const, label: "Scheduled" },
            { value: "manual" as const, label: "Manual" },
          ] as const
        ).map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(opt.value)}
              className={
                selected
                  ? "rounded-md bg-card px-2 py-1.5 text-xs font-medium text-foreground shadow-sm"
                  : "rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {mode === "scheduled" ? (
        scheduleMode === "weekly" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              id="registrationOpensWeekday"
              name="registrationOpensWeekday"
              defaultValue={registrationOpensWeekday}
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
              defaultValue={registrationOpensTime}
              required
            />
          </div>
        ) : (
          <Input
            id="registrationOpensAt"
            name="registrationOpensAt"
            type="datetime-local"
            defaultValue={registrationOpensAtLocal}
            required
          />
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Registration stays closed until you open it.
        </p>
      )}

      {canOpenNow ? (
        <div className="pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={opening}
            onClick={() => void openNow()}
          >
            {opening ? "Opening…" : "Open registration now"}
          </Button>
          {message ? (
            <p className="mt-1 text-xs text-muted-foreground">{message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
