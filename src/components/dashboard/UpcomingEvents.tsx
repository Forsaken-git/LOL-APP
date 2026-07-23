"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime24Weekday } from "@/lib/datetime";
import { LocalDateTime } from "@/components/dashboard/LocalDateTime";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Starting now";

  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type UpcomingEventItem = {
  id: string;
  title: string;
  startAt: string;
};

type Props = {
  events: UpcomingEventItem[];
};

/** Brief window to show "Starting now" before advancing to the next event. */
const STARTING_GRACE_MS = 60_000;

function pickUpcoming(events: UpcomingEventItem[], now: number) {
  return events.filter((e) => new Date(e.startAt).getTime() + STARTING_GRACE_MS > now);
}

export function UpcomingEvents({ events }: Props) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const upcoming = pickUpcoming(events, now);
  const next = upcoming[0] ?? null;
  const rest = upcoming.slice(1);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (upcoming.length > 0 || events.length === 0 || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [upcoming.length, events.length, router]);

  if (!next) {
    return <p className="text-sm text-muted">Nothing scheduled.</p>;
  }

  const remaining = new Date(next.startAt).getTime() - now;

  return (
    <>
      <div className="mb-4 rounded-xl border border-accent/25 bg-accent/5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Next event
        </p>
        <p className="mt-1 font-medium text-foreground">{next.title}</p>
        <p className="mt-2 font-serif text-2xl font-semibold tabular-nums tracking-wide text-accent-bright">
          {formatCountdown(remaining)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {formatDateTime24Weekday(new Date(next.startAt))}
        </p>
      </div>

      {rest.length > 0 ? (
        <ul className="space-y-3">
          {rest.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-medium text-foreground">{e.title}</p>
              <p className="text-muted">
                <LocalDateTime iso={e.startAt} />
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
