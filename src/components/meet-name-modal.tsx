"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateDisplayNameAction,
  type ActionResult,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult | null = null;

/** First-visit prompt when the signed-in user has no display_name. */
export function MeetNameModal() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [state, formAction, pending] = useActionState(
    updateDisplayNameAction,
    initial,
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meet-name-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg">
        <h2
          id="meet-name-title"
          className="font-display text-2xl tracking-tight text-foreground"
        >
          Let’s meet
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          What should we call you? This shows up on activities and memberships.
        </p>
        <form action={formAction} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Full name</Label>
            <Input
              id="displayName"
              name="displayName"
              placeholder="Full name"
              autoComplete="name"
              autoFocus
              required
              minLength={2}
              maxLength={80}
              disabled={pending}
            />
          </div>
          {state && !state.ok ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
