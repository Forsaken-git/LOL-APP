"use client";

import { useState } from "react";
import { parseISO } from "date-fns";
import { formatTime24 } from "@/lib/datetime";
import { Trash2 } from "lucide-react";
import {
  eventTypeLabel,
  eventTypeToMarkerKind,
  MARKER_STYLES,
  type CalendarEvent,
} from "@/lib/calendar-markers";

export function DayEventsList({
  events,
  editingId,
  onEdit,
  onChanged,
}: {
  events: CalendarEvent[];
  editingId?: string | null;
  onEdit: (event: CalendarEvent) => void;
  onChanged: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(id: string) {
    setDeletingId(id);
    setError("");
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      setError("Could not delete event");
      return;
    }
    onChanged();
  }

  if (events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime(),
  );

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Events this day
      </p>
      <ul className="space-y-1">
        {sorted.map((e) => {
          const kind = eventTypeToMarkerKind(e.type);
          const busy = deletingId === e.id;
          const isEditing = editingId === e.id;
          return (
            <li key={e.id}>
              <div
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                  isEditing
                    ? "border-accent/40 bg-accent/10"
                    : "border-border/60 bg-inset/40 hover:border-border-strong hover:bg-inset/60"
                }`}
              >
                <button
                  type="button"
                  data-cal-interactive
                  onClick={() => onEdit(e)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${MARKER_STYLES[kind].dot}`}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {e.title}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-muted">
                    {formatTime24(parseISO(e.startAt))}
                  </span>
                  <span className="hidden shrink-0 text-xs text-faint sm:inline">
                    {eventTypeLabel(e.type)}
                  </span>
                </button>
                <button
                  type="button"
                  data-cal-interactive
                  onClick={() => remove(e.id)}
                  disabled={busy}
                  className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-50"
                  aria-label={`Delete ${e.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
