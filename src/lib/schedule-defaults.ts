import {
  DEFAULT_SCHEDULE_DEFAULTS,
  type ScheduleDefaultsJson,
} from "@/lib/db/schema/activities";

export function parseScheduleDefaults(
  raw: string | null | undefined,
): ScheduleDefaultsJson {
  if (!raw || raw.trim() === "" || raw.trim() === "{}") {
    return { ...DEFAULT_SCHEDULE_DEFAULTS, rankMergeHoursBeforeByRankId: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ScheduleDefaultsJson>;
    return {
      registrationOpensHoursBefore:
        typeof parsed.registrationOpensHoursBefore === "number" &&
        parsed.registrationOpensHoursBefore >= 0
          ? parsed.registrationOpensHoursBefore
          : DEFAULT_SCHEDULE_DEFAULTS.registrationOpensHoursBefore,
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
    return { ...DEFAULT_SCHEDULE_DEFAULTS, rankMergeHoursBeforeByRankId: {} };
  }
}

export function stringifyScheduleDefaults(
  defaults: ScheduleDefaultsJson,
): string {
  return JSON.stringify({
    registrationOpensHoursBefore: defaults.registrationOpensHoursBefore,
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
