/** Normalize to E.164-ish: strip spaces/dashes, ensure leading +. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  if (!trimmed) return trimmed;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
