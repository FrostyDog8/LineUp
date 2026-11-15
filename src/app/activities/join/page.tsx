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

/** Join-via-invite UI stub — invite slug resolution lands in M2. */
export default function JoinActivityPage() {
  return (
    <DashboardShell
      title="Join activity"
      subtitle="Paste an invite link or code from an activity owner."
    >
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Invite</CardTitle>
          <CardDescription>
            Open join vs must-approve is configured per activity. This screen is
            a placeholder until membership flows ship.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action="#">
            <div className="space-y-2">
              <Label htmlFor="invite">Invite link or code</Label>
              <Input
                id="invite"
                name="invite"
                placeholder="https://…/join/abc123 or abc123"
                disabled
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" disabled>
                Join (coming in M2)
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
