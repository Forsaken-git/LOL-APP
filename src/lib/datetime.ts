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
