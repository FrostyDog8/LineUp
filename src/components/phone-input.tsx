"use client";

import { useEffect, useId, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import {
  DEFAULT_COUNTRY,
  formatCallingCode,
  isCountryCode,
  listPhoneCountries,
  toE164,
} from "@/lib/auth/phone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  id?: string;
  label?: string;
  nationalNumber: string;
  country: CountryCode;
  onNationalNumberChange: (value: string) => void;
  onCountryChange: (country: CountryCode) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function PhoneInput({
  id,
  label = "Phone",
  nationalNumber,
  country,
  onNationalNumberChange,
  onCountryChange,
  disabled,
  required,
  className,
}: PhoneInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const countries = listPhoneCountries();
  const e164Preview = toE164(nationalNumber, country);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`${inputId}-country`}>
          Country
        </label>
        <select
          id={`${inputId}-country`}
          className="h-10 max-w-[48%] shrink-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={country}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (isCountryCode(next)) onCountryChange(next);
          }}
          autoComplete="tel-country-code"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} (+{c.callingCode})
            </option>
          ))}
        </select>
        <Input
          id={inputId}
          name="phoneNational"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={country === "IL" ? "0526257840" : "National number"}
          value={nationalNumber}
          onChange={(e) => onNationalNumberChange(e.target.value)}
          disabled={disabled}
          required={required}
          className="min-w-0 flex-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Local number is fine (drop or keep the leading 0). Saved as{" "}
        {e164Preview ?? `${formatCallingCode(country)}…`}.
      </p>
    </div>
  );
}

/** Resolve default country from IP; falls back to Israel. */
export function useDefaultPhoneCountry(): {
  country: CountryCode;
  ready: boolean;
} {
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/geo");
        if (!res.ok) return;
        const body = (await res.json()) as { country?: string };
        if (
          !cancelled &&
          body.country &&
          isCountryCode(body.country.toUpperCase())
        ) {
          setCountry(body.country.toUpperCase() as CountryCode);
        }
      } catch {
        // keep DEFAULT_COUNTRY
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { country, ready };
}
