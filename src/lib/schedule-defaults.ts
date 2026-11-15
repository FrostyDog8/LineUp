import {
  DEFAULT_SCHEDULE_DEFAULTS,
  type ScheduleDefaultsJson,
} from "@/lib/db/schema/activities";
import { parseWeeklyTime } from "@/lib/datetime";

function parseIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseScheduleDefaults(
  raw: string | null | undefined,
): ScheduleDefaultsJson {
  if (!raw || raw.trim() === "" || raw.trim() === "{}") {
    return {
      ...DEFAULT_SCHEDULE_DEFAULTS,
      rankMergeHoursBeforeByRankId: {},
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ScheduleDefaultsJson>;
    const weekday =
      typeof parsed.registrationOpensWeekday === "number" &&
      parsed.registrationOpensWeekday >= 0 &&
      parsed.registrationOpensWeekday <= 6
        ? parsed.registrationOpensWeekday
        : null;
    let time: string | null = null;
    if (
      typeof parsed.registrationOpensTime === "string" &&
      parsed.registrationOpensTime.trim()
    ) {
      try {
        parseWeeklyTime(parsed.registrationOpensTime);
        time = parsed.registrationOpensTime.trim();
      } catch {
        time = null;
      }
    }
    return {
      registrationOpensHoursBefore:
        typeof parsed.registrationOpensHoursBefore === "number" &&
        parsed.registrationOpensHoursBefore >= 0
          ? parsed.registrationOpensHoursBefore
          : DEFAULT_SCHEDULE_DEFAULTS.registrationOpensHoursBefore,
      registrationOpensAt: parseIsoOrNull(parsed.registrationOpensAt),
      registrationOpensWeekday: weekday,
      registrationOpensTime: time,
      defaultRankMergeHoursBefore:
        typeof parsed.defaultRankMergeHoursBefore === "number" &&
        parsed.defaultRankMergeHoursBefore >= 0
          ? parsed.defaultRankMergeHoursBefore
          : DEFAULT_SCHEDULE_DEFAULTS.defaultRankMergeHoursBefore,
      rankMergeHoursBeforeByRankId:
        parsed.rankMergeHoursBeforeByRankId &&
        typeof parsed.rankMergeHoursBeforeByRankId === "object"
          ? parsed.rankMergeHoursBeforeByRankId
          : {},
    };
  } catch {
    return {
      ...DEFAULT_SCHEDULE_DEFAULTS,
      rankMergeHoursBeforeByRankId: {},
    };
  }
}

export function stringifyScheduleDefaults(
  defaults: ScheduleDefaultsJson,
): string {
  return JSON.stringify({
    registrationOpensHoursBefore: defaults.registrationOpensHoursBefore,
    registrationOpensAt: defaults.registrationOpensAt ?? null,
    registrationOpensWeekday: defaults.registrationOpensWeekday ?? null,
    registrationOpensTime: defaults.registrationOpensTime ?? null,
    defaultRankMergeHoursBefore: defaults.defaultRankMergeHoursBefore,
    rankMergeHoursBeforeByRankId: defaults.rankMergeHoursBeforeByRankId ?? {},
  });
}

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export function weekdayLabel(day: number | null | undefined): string {
  if (day == null) return "—";
  return WEEKDAY_OPTIONS.find((o) => o.value === day)?.label ?? "—";
}
