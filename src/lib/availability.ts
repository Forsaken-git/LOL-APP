import {
  WEEKDAYS,
  type AvailabilityData,
  type Weekday,
  emptyAvailability,
} from "@/lib/week";

export const GRID_START_HOUR = 10;
export const GRID_END_HOUR = 23;

export const GRID_HOURS: number[] = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, i) => GRID_START_HOUR + i,
);

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function isHourSelected(data: AvailabilityData, day: Weekday, hour: number): boolean {
  return data[day].includes(hour);
}

export function toggleHour(
  data: AvailabilityData,
  day: Weekday,
  hour: number,
  force?: boolean,
): AvailabilityData {
  const has = data[day].includes(hour);
  const next = force ?? !has;
  const hours = next
    ? [...new Set([...data[day], hour])].sort((a, b) => a - b)
    : data[day].filter((h) => h !== hour);
  return { ...data, [day]: hours };
}

export function setHourRange(
  data: AvailabilityData,
  days: Weekday[],
  startHour: number,
  endHour: number,
  selected: boolean,
): AvailabilityData {
  let next = { ...data };
  for (const day of days) {
    let hours = [...next[day]];
    for (let h = startHour; h <= endHour; h++) {
      if (h < GRID_START_HOUR || h > GRID_END_HOUR) continue;
      if (selected) {
        if (!hours.includes(h)) hours.push(h);
      } else {
        hours = hours.filter((x) => x !== h);
      }
    }
    next = { ...next, [day]: hours.sort((a, b) => a - b) };
  }
  return next;
}

export function clearGrid(data: AvailabilityData): AvailabilityData {
  return emptyAvailability();
}

export function isDayAvailable(data: AvailabilityData, day: Weekday): boolean {
  return data[day].length > 0;
}

/** @deprecated use isDayAvailable */
export function isSlotAvailable(dayHours: number[]): boolean {
  return dayHours.length > 0;
}

export function countDaysWithHours(data: AvailabilityData): number {
  return WEEKDAYS.filter((d) => data[d].length > 0).length;
}

export function countSelectedHours(data: AvailabilityData): number {
  return WEEKDAYS.reduce((sum, d) => sum + data[d].length, 0);
}

export function teamHourCounts(
  board: Record<string, AvailabilityData>,
  players: { id: string }[],
): Record<Weekday, Record<number, number>> {
  const counts = Object.fromEntries(
    WEEKDAYS.map((d) => [d, Object.fromEntries(GRID_HOURS.map((h) => [h, 0]))]),
  ) as Record<Weekday, Record<number, number>>;

  for (const player of players) {
    const data = board[player.id] ?? emptyAvailability();
    for (const day of WEEKDAYS) {
      for (const hour of data[day]) {
        if (counts[day][hour] != null) counts[day][hour]++;
      }
    }
  }
  return counts;
}

export function playersFreeOnDay(
  board: Record<string, AvailabilityData>,
  players: { id: string; displayName: string }[],
  day: Weekday,
): { id: string; displayName: string }[] {
  return players.filter((p) => isDayAvailable(board[p.id] ?? emptyAvailability(), day));
}

export { emptyAvailability, WEEKDAYS };
export type { AvailabilityData, Weekday };
