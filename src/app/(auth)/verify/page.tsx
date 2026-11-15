import { Suspense } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type VerifyInnerProps = {
  searchParams: Promise<{ token?: string; phone?: string }>;
};

async function VerifyInner({ searchParams }: VerifyInnerProps) {
  const params = await searchParams;
  const hasToken = Boolean(params.token);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Magic link</CardTitle>
        <CardDescription>
          {hasToken
            ? "Token received. Session creation is stubbed until auth delivery credentials and Better Auth DB tables are wired."
            : "Open a magic link from WhatsApp auth delivery, or sign in with phone OTP."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {params.phone ? (
          <p className="text-sm text-muted-foreground">
            Phone:{" "}
            <span className="font-medium text-foreground">{params.phone}</span>
          </p>
        ) : null}
        <Button asChild className="w-full">
          <Link href="/dashboard">Continue to dashboard</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Magic-link landing stub — consumes token once Better Auth + delivery are live. */
export default function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; phone?: string }>;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 font-display text-3xl tracking-tight text-foreground"
      >
        LineUp
      </Link>
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Magic link</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <VerifyInner searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
