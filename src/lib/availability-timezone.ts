import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  emptyAvailability,
  WEEKDAYS,
  type AvailabilityData,
  type Weekday,
} from "@/lib/availability";

/** Shared scrim clock — everyone is converted to this for storage / heatmap. */
export const TEAM_TIMEZONE =
  process.env.NEXT_PUBLIC_TEAM_TIMEZONE?.trim() || "Europe/Prague";

/** User-facing name for team time (Central European — CEST in summer, CET in winter). */
export const TEAM_TIME_LABEL = "CEST";

const WEEKDAY_INDEX: Record<Weekday, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const INDEX_WEEKDAY = WEEKDAYS;

export function detectLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || TEAM_TIMEZONE;
  } catch {
    return TEAM_TIMEZONE;
  }
}

/** Short label like "CET" / "CEST" / "GMT+1" for a timezone at a reference instant. */
export function formatTimeZoneAbbreviation(
  timeZone: string,
  at: Date = new Date(),
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function formatTimeZoneCity(timeZone: string): string {
  const city = timeZone.split("/").pop()?.replace(/_/g, " ");
  return city || timeZone;
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekdayIndex: number; // 0=Sun … 6=Sat (JS)
};

function readWallParts(date: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

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
    weekdayIndex: weekdayMap[get("weekday")] ?? 1,
  };
}

/** Offset of `timeZone` at `instant`: local = UTC + offsetMs. */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const wall = readWallParts(instant, timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    0,
  );
  return asUtc - instant.getTime();
}

/** Wall clock in `timeZone` → UTC instant. */
function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let i = 0; i < 4; i++) {
    const offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const next = Date.UTC(year, month - 1, day, hour, 0, 0) - offset;
    if (next === utcMs) break;
    utcMs = next;
  }
  return new Date(utcMs);
}

function mondayYmdFromWeekStart(weekStart: Date): {
  year: number;
  month: number;
  day: number;
} {
  // Availability weeks are keyed by ISO Monday (UTC date from toISOString).
  const iso = weekStart.toISOString().slice(0, 10);
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function jsWeekdayToWeekday(jsIndex: number): Weekday {
  // JS: 0=Sun … 6=Sat → our monday-first
  const mondayFirst = jsIndex === 0 ? 6 : jsIndex - 1;
  return INDEX_WEEKDAY[mondayFirst]!;
}

export type SlotRef = { day: Weekday; hour: number };

/**
 * Convert one weekday+hour wall time from `fromTz` into `toTz` for the given week.
 * Hours outside the grid (10–23) are returned with hour still set (caller filters).
 */
export function convertWeekSlot(
  weekStart: Date,
  slot: SlotRef,
  fromTz: string,
  toTz: string,
): SlotRef {
  if (fromTz === toTz) return slot;

  const monday = mondayYmdFromWeekStart(weekStart);
  const date = addCalendarDays(
    monday.year,
    monday.month,
    monday.day,
    WEEKDAY_INDEX[slot.day],
  );
  const instant = zonedWallToUtc(
    date.year,
    date.month,
    date.day,
    slot.hour,
    fromTz,
  );
  const wall = readWallParts(instant, toTz);
  return {
    day: jsWeekdayToWeekday(wall.weekdayIndex),
    hour: wall.hour,
  };
}

function inGrid(hour: number): boolean {
  return hour >= GRID_START_HOUR && hour <= GRID_END_HOUR;
}

/** Map availability hours from one timezone to another for a week. */
export function convertAvailabilityTimezone(
  data: AvailabilityData,
  weekStart: Date,
  fromTz: string,
  toTz: string,
): AvailabilityData {
  if (fromTz === toTz) {
    return {
      monday: [...data.monday],
      tuesday: [...data.tuesday],
      wednesday: [...data.wednesday],
      thursday: [...data.thursday],
      friday: [...data.friday],
      saturday: [...data.saturday],
      sunday: [...data.sunday],
    };
  }

  const next = emptyAvailability();
  for (const day of WEEKDAYS) {
    for (const hour of data[day]) {
      const converted = convertWeekSlot(
        weekStart,
        { day, hour },
        fromTz,
        toTz,
      );
      if (!inGrid(converted.hour)) continue;
      if (!next[converted.day].includes(converted.hour)) {
        next[converted.day].push(converted.hour);
      }
    }
  }
  for (const day of WEEKDAYS) {
    next[day].sort((a, b) => a - b);
  }
  return next;
}

export function teamToLocalAvailability(
  data: AvailabilityData,
  weekStart: Date,
  localTz: string,
): AvailabilityData {
  return convertAvailabilityTimezone(data, weekStart, TEAM_TIMEZONE, localTz);
}

export function localToTeamAvailability(
  data: AvailabilityData,
  weekStart: Date,
  localTz: string,
): AvailabilityData {
  return convertAvailabilityTimezone(data, weekStart, localTz, TEAM_TIMEZONE);
}

/** Example line: "Your 18:00 → team 17:00" (or same if identical). */
export function formatOffsetExample(
  weekStart: Date,
  localTz: string,
  sampleLocalHour = 18,
): string {
  const converted = convertWeekSlot(
    weekStart,
    { day: "monday", hour: sampleLocalHour },
    localTz,
    TEAM_TIMEZONE,
  );
  const localLabel = `${String(sampleLocalHour).padStart(2, "0")}:00`;
  const teamLabel = `${String(converted.hour).padStart(2, "0")}:00`;
  if (
    converted.day === "monday" &&
    converted.hour === sampleLocalHour &&
    localTz === TEAM_TIMEZONE
  ) {
    return `Same as team time (${TEAM_TIME_LABEL})`;
  }
  const dayNote =
    converted.day !== "monday" ? ` ${converted.day.slice(0, 3)}` : "";
  return `Your ${localLabel} → team ${teamLabel} ${TEAM_TIME_LABEL}${dayNote}`;
}
