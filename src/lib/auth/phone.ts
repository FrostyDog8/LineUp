import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/** Fallback when IP geolocation is unavailable (Omer / IL default). */
export const DEFAULT_COUNTRY: CountryCode = "IL";

export type PhoneCountryOption = {
  code: CountryCode;
  callingCode: string;
  label: string;
};

const REGION_NAMES =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryLabel(code: CountryCode): string {
  return REGION_NAMES?.of(code) ?? code;
}

/** Prefer common countries near the top; rest A–Z by English name. */
const PREFERRED_COUNTRIES: CountryCode[] = [
  "IL",
  "US",
  "GB",
  "DE",
  "FR",
  "NL",
  "ES",
  "IT",
  "CA",
  "AU",
];

let cachedOptions: PhoneCountryOption[] | null = null;

export function listPhoneCountries(): PhoneCountryOption[] {
  if (cachedOptions) return cachedOptions;

  const all = getCountries().map((code) => ({
    code,
    callingCode: getCountryCallingCode(code),
    label: countryLabel(code),
  }));

  const preferred = PREFERRED_COUNTRIES.map(
    (code) => all.find((c) => c.code === code)!,
  ).filter(Boolean);

  const preferredSet = new Set(PREFERRED_COUNTRIES);
  const rest = all
    .filter((c) => !preferredSet.has(c.code))
    .sort((a, b) => a.label.localeCompare(b.label));

  cachedOptions = [...preferred, ...rest];
  return cachedOptions;
}

export function isCountryCode(value: string): value is CountryCode {
  return getCountries().includes(value as CountryCode);
}

/**
 * Normalize raw input to E.164.
 * Accepts full international (+972…) or national digits with a country
 * (e.g. IL + 0526257840 → +972526257840).
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const parsed =
    parsePhoneNumberFromString(trimmed, defaultCountry) ??
    parsePhoneNumberFromString(trimmed);

  if (parsed) return parsed.number;

  // Last-resort strip for already-international-looking strings
  const digits = trimmed.replace(/[\s()-]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return digits;
}

/** Build E.164 from country + national number (drops leading trunk 0). */
export function toE164(
  nationalNumber: string,
  country: CountryCode,
): string | null {
  const trimmed = nationalNumber.trim();
  if (!trimmed) return null;

  // Pasted full international into the national field
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const intl = parsePhoneNumberFromString(
      trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed,
    );
    if (intl?.isValid()) return intl.number;
  }

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (parsed?.isValid()) return parsed.number;

  // Allow slightly incomplete-but-plausible numbers during typing? No — require valid.
  return null;
}

export function isValidPhone(phone: string): boolean {
  const parsed = parsePhoneNumberFromString(phone);
  return Boolean(parsed?.isValid());
}

export function formatCallingCode(country: CountryCode): string {
  return `+${getCountryCallingCode(country)}`;
}
