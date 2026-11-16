import Link from "next/link";
import { Button } from "@/components/ui/button";

export type OccurrenceTab = "line" | "merge" | "settings";

type Props = {
  activityId: string;
  occurrenceId: string;
  active: OccurrenceTab;
  showMerge: boolean;
  showSettings: boolean;
};

export function OccurrenceEventNav({
  activityId,
  occurrenceId,
  active,
  showMerge,
  showSettings,
}: Props) {
  const base = `/activities/${activityId}/events/${occurrenceId}`;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/activities/${activityId}`}>← Events</Link>
      </Button>
      <Button asChild variant={active === "line" ? "default" : "outline"} size="sm">
        <Link href={base}>Line</Link>
      </Button>
      {showMerge ? (
        <Button
          asChild
          variant={active === "merge" ? "default" : "outline"}
          size="sm"
        >
          <Link href={`${base}/merge`}>Merge</Link>
        </Button>
      ) : null}
      {showSettings ? (
        <Button
          asChild
          variant={active === "settings" ? "default" : "outline"}
          size="sm"
        >
          <Link href={`${base}/settings`}>Settings</Link>
        </Button>
      ) : null}
    </div>
  );
}
