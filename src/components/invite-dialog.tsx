"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  inviteUrl: string;
  inviteCode: string;
  activityName: string;
};

export function InviteDialog({ inviteUrl, inviteCode, activityName }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  async function copy(kind: "link" | "code", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Join ${activityName} on LineUp: ${inviteUrl}`,
  )}`;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Invite
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-dialog-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="invite-dialog-title"
              className="font-display text-xl tracking-tight text-foreground"
            >
              Invite
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share the link or code so people can join.
            </p>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Code</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-sm">
                    {inviteCode}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copy("code", inviteCode)}
                  >
                    {copied === "code" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Link</p>
                <p className="break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                  {inviteUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void copy("link", inviteUrl)}
                  >
                    {copied === "link" ? "Copied" : "Copy link"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
