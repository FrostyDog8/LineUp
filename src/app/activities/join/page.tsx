import Link from "next/link";
import { redirect } from "next/navigation";
import { joinActivityAction } from "@/app/actions/activities";
import { ActionForm } from "@/components/action-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionUser } from "@/lib/auth";

export const instant = false;

type Props = {
  searchParams: Promise<{ code?: string; invite?: string }>;
};

export default async function JoinActivityPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const preset = params.code ?? params.invite ?? "";

  return (
    <DashboardShell
      title="Join activity"
      subtitle="Paste an invite link or code from an activity owner."
      userLabel={user.displayName || user.phone}
      askForName={!user.displayName?.trim()}
    >
      <Card className="max-w-lg">
        <CardContent className="pt-4">
          <ActionForm action={joinActivityAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite">Invite link or code</Label>
              <Input
                id="invite"
                name="invite"
                placeholder="abc123 or https://…/activities/join?code=abc123"
                defaultValue={preset}
                required
              />
            </div>
            <div className="flex gap-3">
              <FormSubmitButton pendingLabel="Joining…">Join</FormSubmitButton>
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
