"use client";

import { useState } from "react";
import {
  createOccurrenceAction,
  updateOccurrenceAction,
  type ActionResult,
} from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDateTimeLocal,
  formatEventWhen,
  minDateTimeLocal,
} from "@/lib/datetime";

/** Serializable event row for the client (Dates cross the RSC boundary as ISO strings). */
export type EventListItem = {
  id: string;
  startsAt: string;
  capacity: number | null;
  place: string | null;
  status: string;
  notes: string | null;
};

type Props = {
  activityId: string;
  timezone: string;
  defaultCapacity: number;
  defaultPlace: string | null;
  scheduleMode: "weekly" | "custom";
  canEdit: boolean;
  events: EventListItem[];
};

export function EventsPanel({
  activityId,
  timezone,
  defaultCapacity,
  defaultPlace,
  scheduleMode,
  canEdit,
  events,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const canAdd = canEdit;
  const minStart = minDateTimeLocal(timezone);

  const boundCreate = createOccurrenceAction.bind(null, activityId);

  return (
    <div className="space-y-6">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {scheduleMode === "weekly"
            ? "No upcoming events yet. The weekly pattern will refill this list."
            : "No events yet. Add a future event when you are ready."}
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const startsAt = new Date(event.startsAt);
            const effectiveCapacity = event.capacity ?? defaultCapacity;
            const effectivePlace = event.place ?? defaultPlace;
            const isEditing = editingId === event.id;
            const isPast = startsAt.getTime() <= Date.now();
            const boundUpdate = updateOccurrenceAction.bind(
              null,
              activityId,
              event.id,
            );

            return (
              <li
                key={event.id}
                className="rounded-lg border border-border px-3 py-3"
              >
                {!isEditing ? (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {formatEventWhen(startsAt, timezone)}
                        {isPast ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (past)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Capacity {effectiveCapacity}
                        {event.capacity == null
                          ? " (activity default)"
                          : " (override)"}
                        {effectivePlace
                          ? ` · ${effectivePlace}${event.place == null ? " (default)" : ""}`
                          : ""}
                        {" · "}
                        {event.status}
                        {event.notes ? ` · ${event.notes}` : ""}
                      </p>
                    </div>
                    {canEdit && !isPast ? (
                      <button
                        type="button"
                        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setEditingId(event.id)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <ActionForm
                    action={async (prev, formData) => {
                      const result = await boundUpdate(prev, formData);
                      if (result.ok) setEditingId(null);
                      return result;
                    }}
                    className="space-y-3"
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`startsAt-${event.id}`}>Starts at</Label>
                      <Input
                        id={`startsAt-${event.id}`}
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocal(startsAt, timezone)}
                        min={minStart}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Must be in the future ({timezone}).
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`place-${event.id}`}>Place override</Label>
                      <Input
                        id={`place-${event.id}`}
                        name="place"
                        placeholder={defaultPlace ?? "Activity default"}
                        defaultValue={event.place ?? ""}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use activity default
                        {defaultPlace ? ` (${defaultPlace})` : ""}.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`capacity-${event.id}`}>
                        Capacity override
                      </Label>
                      <Input
                        id={`capacity-${event.id}`}
                        name="capacity"
                        type="number"
                        min={1}
                        placeholder={`Default ${defaultCapacity}`}
                        defaultValue={event.capacity ?? ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`notes-${event.id}`}>Notes</Label>
                      <Input
                        id={`notes-${event.id}`}
                        name="notes"
                        defaultValue={event.notes ?? ""}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <FormSubmitButton size="sm" pendingLabel="…">
                        Save
                      </FormSubmitButton>
                      <button
                        type="button"
                        className="text-sm text-muted-foreground"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canAdd ? (
        <AddEventForm
          action={boundCreate}
          timezone={timezone}
          defaultCapacity={defaultCapacity}
          defaultPlace={defaultPlace}
          minStart={minStart}
        />
      ) : null}
    </div>
  );
}

function AddEventForm({
  action,
  timezone,
  defaultCapacity,
  defaultPlace,
  minStart,
}: {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  timezone: string;
  defaultCapacity: number;
  defaultPlace: string | null;
  minStart: string;
}) {
  return (
    <ActionForm
      action={action}
      className="space-y-3 rounded-lg border border-dashed border-border p-3"
    >
      <p className="text-sm font-medium">Add event</p>
      <div className="space-y-1">
        <Label htmlFor="new-startsAt">Starts at</Label>
        <Input
          id="new-startsAt"
          name="startsAt"
          type="datetime-local"
          min={minStart}
          required
        />
        <p className="text-xs text-muted-foreground">
          Must be in the future. Timezone {timezone}.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-place">Place</Label>
        <Input
          id="new-place"
          name="place"
          placeholder={
            defaultPlace
              ? `Default: ${defaultPlace}`
              : "Uses activity default if blank"
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-capacity">Capacity override</Label>
        <Input
          id="new-capacity"
          name="capacity"
          type="number"
          min={1}
          placeholder={`Default ${defaultCapacity}`}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-notes">Notes</Label>
        <Input id="new-notes" name="notes" />
      </div>
      <FormSubmitButton size="sm" pendingLabel="…">
        Add event
      </FormSubmitButton>
    </ActionForm>
  );
}
