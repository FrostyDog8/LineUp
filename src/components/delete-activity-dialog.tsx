"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteActivityAction } from "@/app/actions/activities";
import { Button } from "@/components/ui/button";

type Props = {
  activityId: string;
  activityName: string;
};

export function DeleteActivityDialog({ activityId, activityName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteActivityAction(activityId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-red-300 text-red-800 hover:bg-red-50"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete activity
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-activity-title"
          onClick={() => {
            if (!deleting) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-activity-title"
              className="font-display text-xl tracking-tight text-foreground"
            >
              Delete activity?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete{" "}
              <span className="font-medium text-foreground">{activityName}</span>
              ? This removes members, events, and ranks. This cannot be undone.
            </p>
            {error ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-red-700 text-white hover:bg-red-800"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={deleting}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
