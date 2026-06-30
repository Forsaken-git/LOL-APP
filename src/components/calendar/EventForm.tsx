"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import type { EventType } from "@prisma/client";
import { COMPETITIONS } from "@/lib/competitions";
import { MARKER_STYLES, type CalendarEvent, type MarkerKind } from "@/lib/calendar-markers";
import {
  formatTime24,
  normalizeTime24Input,
  parseLocalDateTime,
  TIME_24_PATTERN,
} from "@/lib/datetime";

const EVENT_OPTIONS = COMPETITIONS.map((c) => ({
  type: c.eventType,
  kind: c.id as MarkerKind,
  label: c.label,
}));

function defaultTypeForEvent(event: CalendarEvent): EventType {
  const hit = EVENT_OPTIONS.find((o) => o.type === event.type);
  if (hit) return hit.type;
  return COMPETITIONS[0].eventType;
}

export function EventForm({
  selectedDate,
  event,
  onSaved,
  onCancel,
}: {
  selectedDate: Date;
  event?: CalendarEvent | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(event);

  const [type, setType] = useState(COMPETITIONS[0].eventType);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => format(selectedDate, "yyyy-MM-dd"));
  const [time, setTime] = useState("18:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (event) {
      const start = parseISO(event.startAt);
      setTitle(event.title);
      setType(defaultTypeForEvent(event));
      setDate(format(start, "yyyy-MM-dd"));
      setTime(formatTime24(start));
      setError("");
      return;
    }
    setTitle("");
    setType(COMPETITIONS[0].eventType);
    setDate(format(selectedDate, "yyyy-MM-dd"));
    setTime("18:00");
    setError("");
  }, [event, selectedDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");

    const startAt = parseLocalDateTime(date, time);
    if (Number.isNaN(startAt.getTime())) {
      setError("Invalid date or time");
      setLoading(false);
      return;
    }

    const payload = {
      title: title.trim(),
      type,
      startAt: startAt.toISOString(),
    };

    const res = await fetch(isEdit && event ? `/api/events/${event.id}` : "/api/events", {
      method: isEdit && event ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await res.json().catch(() => null)) as { error?: string } | null;

    setLoading(false);
    if (!res.ok) {
      setError(body?.error ?? "Could not save");
      return;
    }

    if (!isEdit) {
      setTitle("");
      setType(COMPETITIONS[0].eventType);
      setDate(format(selectedDate, "yyyy-MM-dd"));
      setTime("18:00");
    }
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {EVENT_OPTIONS.map(({ type: t, kind, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t
                ? MARKER_STYLES[kind].chip
                : "border-border bg-inset/60 text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        required
        className="w-full"
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-muted">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 block"
          />
        </label>
        <label className="block text-xs text-muted">
          Time
          <input
            type="text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={(e) => {
              const normalized = normalizeTime24Input(e.target.value);
              if (normalized) setTime(normalized);
            }}
            required
            inputMode="numeric"
            pattern={TIME_24_PATTERN.source}
            placeholder="18:00"
            className="mt-1 block"
          />
          <span className="mt-1 block text-[10px] text-faint">24h (HH:mm)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {isEdit && onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add event"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </form>
  );
}
