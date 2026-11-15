"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createRankAction,
  deleteRankAction,
  updateRankAction,
} from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTimeLocal } from "@/lib/datetime";
import type { RankRow } from "@/server/ranks";

type Props = {
  activityId: string;
  timezone: string;
  ranks: RankRow[];
};

export function RanksSettings({ activityId, timezone, ranks }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function onNewRank() {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createRankAction(activityId);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {ranks.map((rank) => {
          const boundUpdate = updateRankAction.bind(null, activityId, rank.id);
          return (
            <li
              key={rank.id}
              className="rounded-lg border border-border px-2.5 py-2"
            >
              <ActionForm action={boundUpdate} className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor={`rank-name-${rank.id}`}>Name</Label>
                  <Input
                    id={`rank-name-${rank.id}`}
                    name="name"
                    defaultValue={rank.name}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Merge into main list</Label>
                  <RankMergeFields rank={rank} timezone={timezone} />
                </div>
                <FormSubmitButton size="sm" variant="outline" pendingLabel="…">
                  Save
                </FormSubmitButton>
              </ActionForm>
              {ranks.length <= 1 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Cannot delete the only remaining rank.
                </p>
              ) : (
                <ActionForm
                  action={deleteRankAction.bind(null, activityId, rank.id)}
                  className="mt-1"
                >
                  <FormSubmitButton size="sm" variant="ghost" pendingLabel="…">
                    Delete{rank.isDefault ? " (default)" : ""}
                  </FormSubmitButton>
                </ActionForm>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          disabled={creating}
          onClick={() => void onNewRank()}
        >
          {creating ? "Adding…" : "New rank"}
        </Button>
        {createError ? (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {createError}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Creates “New rank” — rename it and set merge timing.
        </p>
      </div>
    </div>
  );
}

function RankMergeFields({
  rank,
  timezone,
}: {
  rank: RankRow;
  timezone: string;
}) {
  const [mode, setMode] = useState<"manual" | "scheduled">(rank.mergeMode);

  return (
    <div className="space-y-2">
      <input type="hidden" name="mergeMode" value={mode} />
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {(
          [
            { value: "scheduled" as const, label: "Date & time" },
            { value: "manual" as const, label: "Manual" },
          ] as const
        ).map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(opt.value)}
              className={
                selected
                  ? "rounded-md bg-card px-2 py-1.5 text-xs font-medium text-foreground shadow-sm"
                  : "rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {mode === "scheduled" ? (
        <div className="space-y-1">
          <Label htmlFor={`merge-at-${rank.id}`} className="sr-only">
            Merge at
          </Label>
          <Input
            id={`merge-at-${rank.id}`}
            name="mergeAt"
            type="datetime-local"
            required
            defaultValue={
              rank.mergeAt
                ? formatDateTimeLocal(new Date(rank.mergeAt), timezone)
                : ""
            }
          />
          <p className="text-xs text-muted-foreground">
            When this rank merges into the main list.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Merges only when an owner or manager merges it (manual merge action
          lands with line UI).
        </p>
      )}
    </div>
  );
}
