import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Create-activity UI stub — mutations land in M2. */
export default function NewActivityPage() {
  return (
    <DashboardShell
      title="Create activity"
      subtitle="Name, type, timezone, default capacity, and join mode. Saved in M2."
    >
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New activity</CardTitle>
          <CardDescription>
            Form is wired for layout only — submit is disabled until membership
            + ranks CRUD ships.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action="#">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Wednesday volleyball" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type (free text)</Label>
              <Input id="type" name="type" placeholder="volleyball" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                placeholder="Asia/Jerusalem"
                defaultValue="UTC"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Default capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                defaultValue={18}
                disabled
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" disabled>
                Create (coming in M2)
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
