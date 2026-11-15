/** Format a Date as `YYYY-MM-DDTHH:mm` in the given IANA timezone (for datetime-local). */
export function formatDateTimeLocal(
  date: Date,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Parse a naive `YYYY-MM-DDTHH:mm` (or with seconds) as wall clock in `timeZone`
 * and return the corresponding UTC Date.
 */
export function parseDateTimeLocal(
  value: string,
  timeZone: string,
): Date {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Start time is required");

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    trimmed,
  );
  if (!match) throw new Error("Invalid start time");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  // Guess UTC instant, then correct using the zone offset at that instant.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const asLocal = formatDateTimeLocal(new Date(utcMs), timeZone);
    const [datePart, timePart] = asLocal.split("T");
    const [y, m, d] = datePart!.split("-").map(Number);
    const [hh, mm] = timePart!.split(":").map(Number);
    const gotMs = Date.UTC(y!, m! - 1, d!, hh!, mm!, second);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute, second);
    utcMs += wantMs - gotMs;
  }

  return new Date(utcMs);
}

export function formatEventWhen(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
