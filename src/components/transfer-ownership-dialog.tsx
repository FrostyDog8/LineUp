"use client";

import { useState } from "react";
import { transferOwnershipAction } from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MemberRow } from "@/server/memberships";
import type { RankRow } from "@/server/ranks";

type Props = {
  activityId: string;
  /** Other active members eligible to become owner. */
  candidates: MemberRow[];
  ranks: RankRow[];
  defaultRankId: string | null;
  /** Compact trigger for top nav (no empty-state hint under the button). */
  compact?: boolean;
};

export function TransferOwnershipDialog({
  activityId,
  candidates,
  ranks,
  defaultRankId,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const boundTransfer = transferOwnershipAction.bind(null, activityId);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={compact ? "outline" : "secondary"}
        disabled={candidates.length === 0}
        title={
          candidates.length === 0
            ? "Invite and approve another member before transferring"
            : undefined
        }
        onClick={() => setOpen(true)}
      >
        Transfer ownership
      </Button>
      {!compact && candidates.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Invite and approve another member before transferring.
        </p>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="transfer-title"
              className="font-display text-xl tracking-tight text-foreground"
            >
              Transfer ownership
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidates.length === 0
                ? "Invite and approve another member before transferring."
                : "Pick a new owner and your rank afterward."}
            </p>
            {candidates.length > 0 ? (
              <ActionForm
                action={async (prev, formData) => {
                  const result = await boundTransfer(prev, formData);
                  if (result.ok) setOpen(false);
                  return result;
                }}
                className="mt-4 space-y-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="newOwnerUserId">New owner</Label>
                  <select
                    id="newOwnerUserId"
                    name="newOwnerUserId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select member
                    </option>
                    {candidates.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName || m.phone} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="outgoingOwnerRankId">Your new rank</Label>
                  <select
                    id="outgoingOwnerRankId"
                    name="outgoingOwnerRankId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    defaultValue={defaultRankId ?? ranks[0]?.id ?? ""}
                  >
                    {ranks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <FormSubmitButton size="sm" pendingLabel="…">
                    Transfer
                  </FormSubmitButton>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </ActionForm>
            ) : (
              <div className="mt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
