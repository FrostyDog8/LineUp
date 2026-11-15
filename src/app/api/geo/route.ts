import { DEFAULT_COUNTRY, isCountryCode } from "@/lib/auth/phone";

/**
 * Best-effort country for phone default.
 * Prefers CDN/platform geo headers; falls back to Israel (IL).
 */
export async function GET(request: Request) {
  const headers = request.headers;
  const candidates = [
    headers.get("cf-ipcountry"),
    headers.get("x-vercel-ip-country"),
    headers.get("x-country-code"),
    headers.get("cloudfront-viewer-country"),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const code = raw.trim().toUpperCase();
    if (code === "XX" || code === "T1") continue;
    if (isCountryCode(code)) {
      return Response.json({ country: code, source: "header" });
    }
  }

  return Response.json({
    country: DEFAULT_COUNTRY,
    source: "fallback",
  });
}
