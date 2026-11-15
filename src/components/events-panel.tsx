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
import { formatDateTimeLocal, formatEventWhen } from "@/lib/datetime";

/** Serializable event row for the client (Dates cross the RSC boundary as ISO strings). */
export type EventListItem = {
  id: string;
  startsAt: string;
  capacity: number | null;
  status: string;
  notes: string | null;
};

type Props = {
  activityId: string;
  timezone: string;
  defaultCapacity: number;
  scheduleMode: "one_time" | "recurring_simple";
  canEdit: boolean;
  events: EventListItem[];
};

export function EventsPanel({
  activityId,
  timezone,
  defaultCapacity,
  scheduleMode,
  canEdit,
  events,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const canAdd =
    canEdit &&
    (scheduleMode === "recurring_simple" || events.length === 0);

  const boundCreate = createOccurrenceAction.bind(null, activityId);

  return (
    <div className="space-y-6">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {scheduleMode === "recurring_simple"
            ? "No events yet. Add the first occurrence when you are ready."
            : "No event yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const startsAt = new Date(event.startsAt);
            const effectiveCapacity = event.capacity ?? defaultCapacity;
            const isEditing = editingId === event.id;
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
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Capacity {effectiveCapacity}
                        {event.capacity == null ? " (activity default)" : " (override)"}
                        {" · "}
                        {event.status}
                        {event.notes ? ` · ${event.notes}` : ""}
                      </p>
                    </div>
                    {canEdit ? (
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
                        required
                      />
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
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use activity default ({defaultCapacity}).
                        Registration policy hooks later.
                      </p>
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
        />
      ) : null}
    </div>
  );
}

function AddEventForm({
  action,
  timezone,
  defaultCapacity,
}: {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  timezone: string;
  defaultCapacity: number;
}) {
  return (
    <ActionForm action={action} className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <p className="text-sm font-medium">Add event</p>
      <div className="space-y-1">
        <Label htmlFor="new-startsAt">Starts at</Label>
        <Input id="new-startsAt" name="startsAt" type="datetime-local" required />
        <p className="text-xs text-muted-foreground">Timezone {timezone}.</p>
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
