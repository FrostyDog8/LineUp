import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { MeetNameModal } from "@/components/meet-name-modal";
import { Button } from "@/components/ui/button";

type DashboardShellProps = {
  children: React.ReactNode;
  /** Page headline. Pass `null` to hide (content owns the only headline). */
  title?: string | null;
  /**
   * One short supporting line under the title.
   * Omit for the dashboard default; pass `null` for no subtitle.
   */
  subtitle?: string | null;
  userLabel?: string | null;
  /** Show first-visit name prompt when display_name is empty. */
  askForName?: boolean;
  /** Tighter vertical spacing (e.g. create form on desktop). */
  compact?: boolean;
};

export function DashboardShell({
  children,
  title,
  subtitle,
  userLabel,
  askForName = false,
  compact = false,
}: DashboardShellProps) {
  const resolvedTitle = title === undefined ? "My activities" : title;
  const resolvedSubtitle =
    subtitle === undefined
      ? "Create a new activity or join one with an invite link."
      : subtitle;
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="font-display text-xl tracking-tight text-foreground"
          >
            LineUp
          </Link>
          <nav className="flex items-center gap-2">
            {userLabel ? (
              <span className="hidden text-xs text-muted-foreground sm:inline max-w-[10rem] truncate">
                {userLabel}
              </span>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/activities/join">
                <UserPlus className="size-4" />
                Join
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/activities/new">
                <Plus className="size-4" />
                Create
              </Link>
            </Button>
            {userLabel ? (
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main
        className={
          compact
            ? "mx-auto w-full max-w-5xl flex-1 px-4 py-4 sm:px-6"
            : "mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6"
        }
      >
        {resolvedTitle || resolvedSubtitle ? (
          <div
            className={
              compact
                ? "mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
                : "mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
            }
          >
            <div>
              {resolvedTitle ? (
                <h1
                  className={
                    compact
                      ? "font-display text-2xl tracking-tight text-foreground sm:text-3xl"
                      : "font-display text-3xl tracking-tight text-foreground sm:text-4xl"
                  }
                >
                  {resolvedTitle}
                </h1>
              ) : null}
              {resolvedSubtitle ? (
                <p
                  className={
                    resolvedTitle
                      ? "mt-1 max-w-xl text-sm text-muted-foreground"
                      : "max-w-xl text-sm text-muted-foreground"
                  }
                >
                  {resolvedSubtitle}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {children}
      </main>
      {askForName ? <MeetNameModal /> : null}
    </div>
  );
}
