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

/** Parts of a Date in an IANA timezone. */
export function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun … 6=Sat
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

export function parseWeeklyTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Weekly time must be HH:mm");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Weekly time must be HH:mm");
  }
  return { hour, minute };
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Next `count` future starts for a weekly weekday + HH:mm pattern in `timeZone`,
 * strictly after `after` (default: now).
 */
export function nextWeeklyStarts(
  weekday: number,
  timeHHmm: string,
  timeZone: string,
  count: number,
  after: Date = new Date(),
): Date[] {
  if (weekday < 0 || weekday > 6) {
    throw new Error("Weekday must be 0 (Sun) through 6 (Sat)");
  }
  if (count < 1) return [];

  const { hour, minute } = parseWeeklyTime(timeHHmm);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const today = zonedParts(after, timeZone);
  const results: Date[] = [];

  for (
    let dayOffset = 0;
    results.length < count && dayOffset < count * 7 + 14;
    dayOffset++
  ) {
    const cal = addCalendarDays(today.year, today.month, today.day, dayOffset);
    const y = String(cal.year).padStart(4, "0");
    const m = String(cal.month).padStart(2, "0");
    const d = String(cal.day).padStart(2, "0");
    // Noon probe avoids DST edge cases when reading weekday for that calendar day.
    const noon = parseDateTimeLocal(`${y}-${m}-${d}T12:00`, timeZone);
    if (zonedParts(noon, timeZone).weekday !== weekday) continue;

    const start = parseDateTimeLocal(`${y}-${m}-${d}T${hh}:${mm}`, timeZone);
    if (start.getTime() > after.getTime()) {
      results.push(start);
    }
  }

  return results;
}

/** Reject past (or equal) start times. */
export function assertFutureStart(startsAt: Date, now: Date = new Date()): void {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    throw new Error("Invalid start time");
  }
  if (startsAt.getTime() <= now.getTime()) {
    throw new Error("Events must start in the future");
  }
}

/** Minimum `datetime-local` value (now + 1 minute) in a timezone. */
export function minDateTimeLocal(
  timeZone: string,
  now: Date = new Date(),
): string {
  return formatDateTimeLocal(new Date(now.getTime() + 60_000), timeZone);
}

/**
 * Latest weekday + HH:mm instant in `timeZone` that is strictly before `before`.
 * Used for weekly registration-open and rank-merge times relative to an occurrence.
 */
export function previousWeeklyInstant(
  weekday: number,
  timeHHmm: string,
  timeZone: string,
  before: Date,
): Date {
  if (weekday < 0 || weekday > 6) {
    throw new Error("Weekday must be 0 (Sun) through 6 (Sat)");
  }
  const { hour, minute } = parseWeeklyTime(timeHHmm);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const anchor = zonedParts(before, timeZone);

  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const cal = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      -dayOffset,
    );
    const y = String(cal.year).padStart(4, "0");
    const m = String(cal.month).padStart(2, "0");
    const d = String(cal.day).padStart(2, "0");
    const noon = parseDateTimeLocal(`${y}-${m}-${d}T12:00`, timeZone);
    if (zonedParts(noon, timeZone).weekday !== weekday) continue;
    const instant = parseDateTimeLocal(`${y}-${m}-${d}T${hh}:${mm}`, timeZone);
    if (instant.getTime() < before.getTime()) {
      return instant;
    }
  }

  throw new Error("Could not resolve weekly instant before event");
}
