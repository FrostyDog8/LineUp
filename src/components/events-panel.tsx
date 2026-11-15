"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createOccurrenceAction,
  deleteOccurrenceAction,
  openRegistrationForOccurrenceAction,
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
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const canAdd = canEdit;
  const minStart = minDateTimeLocal(timezone);
  const boundCreate = createOccurrenceAction.bind(null, activityId);

  async function confirmRemove() {
    if (!removingId) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const result = await deleteOccurrenceAction(activityId, removingId);
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      setRemovingId(null);
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  async function openRegistration(occurrenceId: string) {
    setOpeningId(occurrenceId);
    setOpenError(null);
    try {
      const result = await openRegistrationForOccurrenceAction(
        activityId,
        occurrenceId,
      );
      if (!result.ok) {
        setOpenError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setOpeningId(null);
    }
  }

  const removingEvent = removingId
    ? events.find((e) => e.id === removingId)
    : null;

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

      {openError ? (
        <p className="text-sm text-red-700" role="alert">
          {openError}
        </p>
      ) : null}

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
                className="rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/activities/${activityId}/events/${event.id}`}
                    className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="font-medium text-foreground">
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
                      {" · "}
                      <span className="text-primary">Open line</span>
                    </p>
                  </Link>
                  {canEdit && !isPast ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {event.status === "scheduled" ? (
                        <button
                          type="button"
                          className="text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                          disabled={openingId === event.id}
                          onClick={() => void openRegistration(event.id)}
                        >
                          {openingId === event.id
                            ? "Opening…"
                            : "Open registration"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setEditingId(event.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm text-red-700 underline-offset-2 hover:underline"
                        onClick={() => {
                          setRemoveError(null);
                          setRemovingId(event.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {removingEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-event-title"
          onClick={() => !removing && setRemovingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="remove-event-title"
              className="font-display text-xl tracking-tight text-foreground"
            >
              Remove event?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Remove{" "}
              {formatEventWhen(
                new Date(removingEvent.startsAt),
                timezone,
              )}
              {removingEvent.subHeadline
                ? ` (${removingEvent.subHeadline})`
                : ""}
              ? This cannot be undone.
              {scheduleMode === "weekly"
                ? " A later weekly event may be added to keep the upcoming list topped up."
                : ""}
            </p>
            {removeError ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {removeError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={removing}
                onClick={() => void confirmRemove()}
              >
                {removing ? "Removing…" : "Remove"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={removing}
                onClick={() => setRemovingId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
