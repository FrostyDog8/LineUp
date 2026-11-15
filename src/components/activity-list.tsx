import Link from "next/link";
import { CalendarDays, Plus, UserPlus } from "lucide-react";
import type { ActivitySummary } from "@/server/activities";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ActivityList({ activities }: { activities: ActivitySummary[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
        <CalendarDays className="mx-auto size-10 text-muted-foreground/70" />
        <h2 className="mt-4 font-display text-xl text-foreground">
          No activities yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your personal dashboard lists activities you own, manage, or have
          joined. Create one or join with an invite to get started.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/activities/new">
              <Plus className="size-4" />
              Create activity
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/activities/join">
              <UserPlus className="size-4" />
              Join activity
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {activities.map((activity) => (
        <li key={activity.id}>
          <Card>
            <CardHeader>
              <CardTitle>{activity.name}</CardTitle>
              <CardDescription>
                {activity.typeText || "Activity"} · {activity.role}
                {activity.status === "requested" ? " · pending" : ""} ·{" "}
                {activity.timezone}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={`/activities/${activity.id}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
