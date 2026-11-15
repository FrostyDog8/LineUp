"use client";

import { useState } from "react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAY_OPTIONS } from "@/lib/schedule-defaults";

export function CreateActivityFields() {
  const [scheduleMode, setScheduleMode] = useState<"weekly" | "custom">(
    "weekly",
  );

  return (
    <>
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
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1">
          <input type="hidden" name="scheduleMode" value={scheduleMode} />
          {(
            [
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
          {scheduleMode === "weekly"
            ? "Fills the next 5 future events from your weekly pattern. Each event can override defaults later."
            : "Starts with an empty events list. Add one or more future events after create (covers one-offs too)."}
        </p>
      </div>

      {scheduleMode === "weekly" ? (
        <div className="space-y-4 rounded-lg border border-border p-3">
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
            <p className="text-xs text-muted-foreground">
              Timezone Asia/Jerusalem (server default).
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registrationOpensHoursBefore">
                Registration opens
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="registrationOpensHoursBefore"
                  name="registrationOpensHoursBefore"
                  type="number"
                  min={0}
                  defaultValue={48}
                  required
                />
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  hours before
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultRankMergeHoursBefore">
                Rank merge default
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="defaultRankMergeHoursBefore"
                  name="defaultRankMergeHoursBefore"
                  type="number"
                  min={0}
                  defaultValue={24}
                  required
                />
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  hours before
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These are activity defaults. Individual events can override place and
            capacity; registration timing hooks apply in a later milestone.
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div className="space-y-2">
            <Label htmlFor="defaultPlace">Default place</Label>
            <Input
              id="defaultPlace"
              name="defaultPlace"
              placeholder="Optional venue"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registrationOpensHoursBefore">
                Registration opens
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="registrationOpensHoursBefore"
                  name="registrationOpensHoursBefore"
                  type="number"
                  min={0}
                  defaultValue={48}
                  required
                />
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  hours before
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultRankMergeHoursBefore">
                Rank merge default
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="defaultRankMergeHoursBefore"
                  name="defaultRankMergeHoursBefore"
                  type="number"
                  min={0}
                  defaultValue={24}
                  required
                />
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  hours before
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
      </div>
    </>
  );
}
