"use client";

import { useState } from "react";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateActivityFields() {
  const [scheduleMode, setScheduleMode] = useState<
    "one_time" | "recurring_simple"
  >("one_time");

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
              { value: "one_time" as const, label: "One-time" },
              { value: "recurring_simple" as const, label: "Recurring" },
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
            ? "Creates one event so people can register later."
            : "Starts with an empty events list — add events after create."}
        </p>
      </div>

      {scheduleMode === "one_time" ? (
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts at</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
          />
          <p className="text-xs text-muted-foreground">
            Timezone Asia/Jerusalem (server default).
          </p>
        </div>
      ) : null}

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
