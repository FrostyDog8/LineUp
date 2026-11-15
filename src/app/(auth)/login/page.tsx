"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import {
  fetchAuthConfig,
  requestDevLogin,
  requestLoginChallenge,
  verifyLoginCode,
} from "@/lib/auth/client";
import { DEFAULT_COUNTRY, toE164 } from "@/lib/auth/phone";
import { PhoneInput, useDefaultPhoneCountry } from "@/components/phone-input";
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
  const geo = useDefaultPhoneCountry();
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [countryTouched, setCountryTouched] = useState(false);
  const [nationalNumber, setNationalNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [devBypass, setDevBypass] = useState(false);
  const [signedE164, setSignedE164] = useState<string | null>(null);

  useEffect(() => {
    void fetchAuthConfig().then((cfg) => setDevBypass(cfg.devBypass));
  }, []);

  useEffect(() => {
    if (geo.ready && !countryTouched) setCountry(geo.country);
  }, [geo.ready, geo.country, countryTouched]);

  function resolveE164(): string | null {
    return toE164(nationalNumber, country);
  }

  async function startChallenge() {
    setError(null);
    setMessage(null);
    const phone = resolveE164();
    if (!phone) {
      setError("Enter a valid phone number for the selected country.");
      return;
    }
    setPending(true);
    try {
      const result = await requestLoginChallenge(phone);
      setSignedE164(phone);
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

  async function onRequestChallenge(e: React.FormEvent) {
    e.preventDefault();
    await startChallenge();
  }

  async function onDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const phone = resolveE164();
    if (!phone) {
      setError("Enter a valid phone number for the selected country.");
      return;
    }
    setPending(true);
    try {
      await requestDevLogin(phone);
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
    const phone = signedE164 ?? resolveE164();
    if (!phone) {
      setError("Enter a valid phone number for the selected country.");
      return;
    }
    setPending(true);
    try {
      await verifyLoginCode(phone, code.trim());
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
              <PhoneInput
                nationalNumber={nationalNumber}
                country={country}
                onNationalNumberChange={setNationalNumber}
                onCountryChange={(next) => {
                  setCountryTouched(true);
                  setCountry(next);
                }}
                disabled={pending}
                required
              />
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
                  onClick={() => void startChallenge()}
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
