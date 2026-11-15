import { redirect } from "next/navigation";
import { createActivityAction } from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { CreateActivityFields } from "@/components/create-activity-fields";
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
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";

export const instant = false;

export default async function NewActivityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell
      title="Create activity"
      subtitle="You become the owner. Default ranks member + New are created."
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
    >
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>New activity</CardTitle>
          <CardDescription>
            Choose One-time, Weekly, or Custom; then join mode and capacity.
            Invite link is generated on create.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createActivityAction} className="space-y-6">
            <CreateActivityFields />
            <div className="flex flex-wrap gap-3 border-t border-border pt-4">
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
