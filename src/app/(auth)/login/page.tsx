"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchAuthConfig,
  requestDevLogin,
  requestLoginChallenge,
  verifyLoginCode,
} from "@/lib/auth/client";
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

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    void fetchAuthConfig().then((cfg) => setDevBypass(cfg.devBypass));
  }, []);

  async function onRequestChallenge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const result = await requestLoginChallenge(phone.trim());
      setStep("code");
      setMessage(
        result.stubbed
          ? "Delivery adapter stubbed (no Twilio/WhatsApp credentials). Enter any 6-digit code to continue when AUTH_DEV_BYPASS or development is on."
          : "Check your phone for a code or magic link.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  async function onDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await requestDevLogin(phone.trim(), displayName.trim() || undefined);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed");
    } finally {
      setPending(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await verifyLoginCode(phone.trim(), code.trim());
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 font-display text-3xl tracking-tight text-foreground"
      >
        LineUp
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Phone is your account key.{" "}
            {devBypass
              ? "Dev login is enabled — skip OTP with the button below."
              : "Use OTP / magic link when delivery credentials are configured."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form
              onSubmit={devBypass ? onDevLogin : onRequestChallenge}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (E.164)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+972501234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </div>
              {devBypass ? (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display name (optional)</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    placeholder="Omer"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="nickname"
                  />
                </div>
              ) : null}
              {devBypass ? (
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Signing in…" : "Dev sign-in"}
                </Button>
              ) : (
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Sending…" : "Continue"}
                </Button>
              )}
              {devBypass ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={onRequestChallenge}
                >
                  Use OTP flow instead
                </Button>
              ) : null}
            </form>
          ) : (
            <form onSubmit={onVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Verifying…" : "Verify & continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("phone")}
              >
                Use a different number
              </Button>
            </form>
          )}
          {message ? (
            <p className="mt-4 text-sm text-muted-foreground">{message}</p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
