import { format } from "date-fns";

/** HTML/text input pattern for 24-hour times (HH:mm). */
export const TIME_24_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/** Normalize a HH:mm string; returns null when invalid. */
export function normalizeTime24Input(value: string): string | null {
  const m = TIME_24_PATTERN.exec(value.trim());
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/** 24-hour clock, e.g. 14:30 */
export function formatTime24(date: Date): string {
  return format(date, "HH:mm");
}

/** Date + 24h time, e.g. May 28, 2025 · 14:30 */
export function formatDateTime24(date: Date): string {
  return format(date, "MMM d, yyyy · HH:mm");
}

/** Compact date + 24h time, e.g. May 28 · 14:30 */
export function formatDateTime24Compact(date: Date): string {
  return format(date, "MMM d · HH:mm");
}

/** Weekday date + 24h time, e.g. Wed, May 28 · 14:30 */
export function formatDateTime24Weekday(date: Date): string {
  return format(date, "EEE, MMM d · HH:mm");
}

/** Long weekday date + 24h time */
export function formatDateTime24Long(date: Date): string {
  return format(date, "EEE MMM d, yyyy · HH:mm");
}

/** Combine HTML date + time inputs into a local Date. */
export function parseLocalDateTime(date: string, time: string): Date {
  const [h, m] = time.split(":").map((part) => parseInt(part, 10));
  const [y, mo, d] = date.split("-").map((part) => parseInt(part, 10));
  if (
    [y, mo, d, h, m].some((n) => Number.isNaN(n)) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return new Date(NaN);
  }
  return new Date(y, mo - 1, d, h, m, 0, 0);
}
