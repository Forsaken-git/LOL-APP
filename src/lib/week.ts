import { addDays, format, startOfWeek } from "date-fns";

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** Hours selected per day (integers 10–23). */
export type AvailabilityData = Record<Weekday, number[]>;

export function emptyAvailability(): AvailabilityData {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

export function getWeekStart(date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${format(weekStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

function legacyStringToHours(value: string): number[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "busy") return [];

  const presetRanges: Record<string, [number, number]> = {
    "18:00–22:00": [18, 22],
    "18:00-22:00": [18, 22],
    "14:00–18:00": [14, 18],
    "14:00-18:00": [14, 18],
    "10:00–22:00": [10, 22],
    "10:00-22:00": [10, 22],
  };

  const range = presetRanges[trimmed.toLowerCase()];
  if (range) {
    const [start, end] = range;
    const hours: number[] = [];
    for (let h = start; h <= end; h++) hours.push(h);
    return hours;
  }

  const match = trimmed.match(/(\d{1,2}):?\d{0,2}\s*[–-]\s*(\d{1,2})/);
  if (match) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      const hours: number[] = [];
      for (let h = Math.min(start, end); h <= Math.max(start, end); h++) {
        hours.push(h);
      }
      return hours;
    }
  }

  return [];
}

function parseDayHours(value: unknown): number[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((h): h is number => typeof h === "number"))]
      .filter((h) => h >= 10 && h <= 23)
      .sort((a, b) => a - b);
  }
  if (typeof value === "string") {
    return legacyStringToHours(value)
      .filter((h) => h >= 10 && h <= 23)
      .sort((a, b) => a - b);
  }
  return [];
}

export function parseAvailability(json: string): AvailabilityData {
  try {
    const parsed = JSON.parse(json) as Partial<Record<Weekday, unknown>>;
    const data = emptyAvailability();
    for (const day of WEEKDAYS) {
      data[day] = parseDayHours(parsed[day]);
    }
    return data;
  } catch {
    return emptyAvailability();
  }
}
