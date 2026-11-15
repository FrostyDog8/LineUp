"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createOccurrenceAction,
  updateOccurrenceAction,
  type ActionResult,
} from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button } from "@/components/ui/button";
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
  subHeadline: string | null;
  notes: string | null;
};

type Props = {
  activityId: string;
  timezone: string;
  defaultCapacity: number;
  defaultPlace: string | null;
  scheduleMode: "one_time" | "weekly" | "custom";
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
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canAdd = canEdit;
  const minStart = minDateTimeLocal(timezone);
  const boundCreate = createOccurrenceAction.bind(null, activityId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg tracking-tight text-foreground">
          Upcoming events
        </h2>
        {canAdd ? (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            Add event
          </Button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {scheduleMode === "weekly"
            ? "No upcoming events yet."
            : "No events yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const startsAt = new Date(event.startsAt);
            const effectiveCapacity = event.capacity ?? defaultCapacity;
            const effectivePlace = event.place ?? defaultPlace;
            const isPast = startsAt.getTime() <= Date.now();

            return (
              <li
                key={event.id}
                className="rounded-lg border border-border px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatEventWhen(startsAt, timezone)}
                      {isPast ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (past)
                        </span>
                      ) : null}
                    </p>
                    {event.subHeadline ? (
                      <p className="text-sm text-foreground/90">
                        {event.subHeadline}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Capacity {effectiveCapacity}
                      {effectivePlace ? ` · ${effectivePlace}` : ""}
                      {" · "}
                      {event.status}
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
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <EventDialog
          title="New event"
          defaultCapacity={defaultCapacity}
          defaultPlace={defaultPlace}
          minStart={minStart}
          action={boundCreate}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {editingId
        ? (() => {
            const event = events.find((e) => e.id === editingId);
            if (!event) return null;
            const startsAt = new Date(event.startsAt);
            const boundUpdate = updateOccurrenceAction.bind(
              null,
              activityId,
              event.id,
            );
            return (
              <EventDialog
                title="Edit event"
                defaultCapacity={defaultCapacity}
                defaultPlace={defaultPlace}
                minStart={minStart}
                action={boundUpdate}
                onClose={() => setEditingId(null)}
                initial={{
                  startsAt: formatDateTimeLocal(startsAt, timezone),
                  place: event.place ?? "",
                  capacity: event.capacity?.toString() ?? "",
                  subHeadline: event.subHeadline ?? "",
                }}
              />
            );
          })()
        : null}
    </div>
  );
}

function EventDialog({
  title,
  defaultCapacity,
  defaultPlace,
  minStart,
  action,
  onClose,
  initial,
}: {
  title: string;
  defaultCapacity: number;
  defaultPlace: string | null;
  minStart: string;
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  onClose: () => void;
  initial?: {
    startsAt: string;
    place: string;
    capacity: string;
    subHeadline: string;
  };
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="event-dialog-title"
          className="font-display text-xl tracking-tight text-foreground"
        >
          {title}
        </h2>
        <ActionForm
          action={async (prev, formData) => {
            const result = await action(prev, formData);
            if (result.ok) {
              onClose();
              router.refresh();
            }
            return result;
          }}
          className="mt-4 space-y-3"
        >
          <div className="space-y-1">
            <Label htmlFor="dialog-startsAt">Starts at</Label>
            <Input
              id="dialog-startsAt"
              name="startsAt"
              type="datetime-local"
              min={minStart}
              defaultValue={initial?.startsAt}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dialog-subHeadline">Sub-headline</Label>
            <Input
              id="dialog-subHeadline"
              name="subHeadline"
              placeholder="Optional — e.g. Courts 1–2"
              defaultValue={initial?.subHeadline}
              maxLength={120}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dialog-place">Place</Label>
            <Input
              id="dialog-place"
              name="place"
              placeholder={
                defaultPlace
                  ? `Default: ${defaultPlace}`
                  : "Uses activity default if blank"
              }
              defaultValue={initial?.place}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dialog-capacity">Capacity override</Label>
            <Input
              id="dialog-capacity"
              name="capacity"
              type="number"
              min={1}
              placeholder={`Default ${defaultCapacity}`}
              defaultValue={initial?.capacity}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <FormSubmitButton size="sm" pendingLabel="Saving…">
              Save
            </FormSubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
