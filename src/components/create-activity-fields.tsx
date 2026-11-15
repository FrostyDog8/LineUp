"use client";

import { useState } from "react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { minDateTimeLocal } from "@/lib/datetime";
import { WEEKDAY_OPTIONS } from "@/lib/schedule-defaults";

const DEFAULT_TZ = "Asia/Jerusalem";

export function CreateActivityFields() {
  const [scheduleMode, setScheduleMode] = useState<
    "one_time" | "weekly" | "custom"
  >("weekly");
  const minStart = minDateTimeLocal(DEFAULT_TZ);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Wednesday volleyball"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Schedule</Label>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1">
            <input type="hidden" name="scheduleMode" value={scheduleMode} />
            {(
              [
                { value: "one_time" as const, label: "One-time" },
                { value: "weekly" as const, label: "Weekly" },
                { value: "custom" as const, label: "Custom" },
              ] as const
            ).map((opt) => {
              const selected = scheduleMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setScheduleMode(opt.value)}
                  className={
                    selected
                      ? "rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm"
                      : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {scheduleMode === "one_time"
              ? "Creates a single future event so people can register."
              : scheduleMode === "weekly"
                ? "Fills the next 5 future events from your weekly pattern. Each event can override defaults later."
                : "Starts with an empty events list. Add future events after create."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultCapacity">Default capacity</Label>
          <Input
            id="defaultCapacity"
            name="defaultCapacity"
            type="number"
            min={1}
            defaultValue={18}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Join mode</Label>
          <SegmentedToggle
            name="joinMode"
            ariaLabel="Join mode"
            defaultValue="must_approve"
            options={[
              { value: "open", label: "Open" },
              { value: "must_approve", label: "Approval required" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Open lets anyone with the invite join; Approval required needs your
            OK first.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {scheduleMode === "one_time" ? (
          <div className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts at</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                min={minStart}
                required
              />
              <p className="text-xs text-muted-foreground">
                Timezone Asia/Jerusalem (server default). Must be in the future.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPlace">Place</Label>
              <Input
                id="defaultPlace"
                name="defaultPlace"
                placeholder="Central park courts"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationOpensAt">Registration opens</Label>
              <Input
                id="registrationOpensAt"
                name="registrationOpensAt"
                type="datetime-local"
                required
              />
              <p className="text-xs text-muted-foreground">
                Date and time when registration opens for this event.
              </p>
            </div>
          </div>
        ) : null}

        {scheduleMode === "weekly" ? (
          <div className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weeklyWeekday">Day of week</Label>
                <select
                  id="weeklyWeekday"
                  name="weeklyWeekday"
                  required
                  defaultValue="3"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {WEEKDAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyTime">Time</Label>
                <Input
                  id="weeklyTime"
                  name="weeklyTime"
                  type="time"
                  defaultValue="19:00"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Timezone Asia/Jerusalem (server default).
            </p>
            <div className="space-y-2">
              <Label htmlFor="defaultPlace">Place</Label>
              <Input
                id="defaultPlace"
                name="defaultPlace"
                placeholder="Central park courts"
              />
            </div>
            <div className="space-y-2">
              <Label>Registration opens</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="registrationOpensWeekday" className="sr-only">
                    Registration day
                  </Label>
                  <select
                    id="registrationOpensWeekday"
                    name="registrationOpensWeekday"
                    required
                    defaultValue="1"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {WEEKDAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationOpensTime" className="sr-only">
                    Registration time
                  </Label>
                  <Input
                    id="registrationOpensTime"
                    name="registrationOpensTime"
                    type="time"
                    defaultValue="12:00"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Weekly default for when registration opens (day + time).
                Individual events can override later.
              </p>
            </div>
          </div>
        ) : null}

        {scheduleMode === "custom" ? (
          <div className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
            <div className="space-y-2">
              <Label htmlFor="defaultPlace">Default place</Label>
              <Input
                id="defaultPlace"
                name="defaultPlace"
                placeholder="Optional venue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationOpensAt">Registration opens</Label>
              <Input
                id="registrationOpensAt"
                name="registrationOpensAt"
                type="datetime-local"
                required
              />
              <p className="text-xs text-muted-foreground">
                Default date and time when registration opens. Events can
                override later.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
