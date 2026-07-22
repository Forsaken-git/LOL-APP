"use client";

import { formatDateTime24Weekday } from "@/lib/datetime";

/** Formats an ISO datetime in the viewer's local timezone. */
export function LocalDateTime({ iso }: { iso: string }) {
  return <>{formatDateTime24Weekday(new Date(iso))}</>;
}
