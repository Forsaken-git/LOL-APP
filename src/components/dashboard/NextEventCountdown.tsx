"use client";

import { useEffect, useState } from "react";
import { formatDateTime24Weekday } from "@/lib/datetime";

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

type Props = {
  title: string;
  startAt: string;
};

export function NextEventCountdown({ title, startAt }: Props) {
  const start = new Date(startAt);
  const target = start.getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="mb-4 rounded-xl border border-accent/25 bg-accent/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        Next event
      </p>
      <p className="mt-1 font-medium text-foreground">{title}</p>
      <p className="mt-2 font-serif text-2xl font-semibold tabular-nums tracking-wide text-accent-bright">
        {formatCountdown(remaining)}
      </p>
      <p className="mt-1 text-sm text-muted">{formatDateTime24Weekday(start)}</p>
    </div>
  );
}
