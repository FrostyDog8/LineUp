import { redirect } from "next/navigation";
import { createActivityAction } from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
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
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";

export const instant = false;

export default async function NewActivityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell
      title="Create activity"
      subtitle="You become the owner. Default ranks Regular + New are created."
      userLabel={user.displayName || user.phone}
    >
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New activity</CardTitle>
          <CardDescription>
            Set join mode, capacity, and timezone. Invite link is generated on
            create.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createActivityAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Wednesday volleyball"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeText">Type (free text)</Label>
              <Input
                id="typeText"
                name="typeText"
                placeholder="volleyball"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                placeholder="Asia/Jerusalem"
                defaultValue="Asia/Jerusalem"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultCapacity">Default capacity</Label>
              <Input
                id="defaultCapacity"
                name="defaultCapacity"
                type="number"
                min={1}
                defaultValue={18}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinMode">Join mode</Label>
              <select
                id="joinMode"
                name="joinMode"
                defaultValue="must_approve"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="must_approve">Must approve</option>
                <option value="open">Open</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultRankName">Default rank name</Label>
              <Input
                id="defaultRankName"
                name="defaultRankName"
                defaultValue="Regular"
              />
            </div>
            <div className="flex gap-3">
              <FormSubmitButton pendingLabel="Creating…">Create</FormSubmitButton>
              <Button asChild variant="outline">
                <Link href="/dashboard">Cancel</Link>
              </Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
