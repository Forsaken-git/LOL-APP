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

export type AvailabilityData = Record<Weekday, string>;

export function emptyAvailability(): AvailabilityData {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
}

export function getWeekStart(date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${format(weekStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function parseAvailability(json: string): AvailabilityData {
  try {
    const parsed = JSON.parse(json) as Partial<AvailabilityData>;
    return { ...emptyAvailability(), ...parsed };
  } catch {
    return emptyAvailability();
  }
}
