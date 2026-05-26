"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { DayEventsList } from "@/components/calendar/DayEventsList";
import { EventForm } from "@/components/calendar/EventForm";
import { eventsOnDay, type CalendarEvent } from "@/lib/calendar-markers";
import { MonthCalendarGrid } from "./MonthCalendarGrid";
import { useMonthCalendar } from "./useMonthCalendar";

export function OverviewCalendar() {
  const router = useRouter();
  const cal = useMonthCalendar();
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setEditingEvent(null);
  }, []);

  const onEventsChanged = useCallback(() => {
    cal.reload();
    router.refresh();
  }, [cal.reload, router]);

  const onEventSaved = useCallback(() => {
    setEditingEvent(null);
    onEventsChanged();
  }, [onEventsChanged]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  function openEnlarged(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-cal-interactive]")) return;
    setOpen(true);
  }

  const selectedDayEvents = eventsOnDay(cal.events, cal.selected);

  useEffect(() => {
    if (!editingEvent) return;
    const stillOnDay = selectedDayEvents.some((e) => e.id === editingEvent.id);
    if (!stillOnDay) setEditingEvent(null);
  }, [cal.selected, selectedDayEvents, editingEvent]);

  const gridProps = {
    viewDate: cal.viewDate,
    selected: cal.selected,
    hovered: cal.hovered,
    onSelect: cal.setSelected,
    onHover: cal.setHovered,
    onPrevMonth: cal.prevMonth,
    onNextMonth: cal.nextMonth,
    markerFor: cal.markerFor,
    legend: cal.legend,
    loading: cal.loading,
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openEnlarged}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-full cursor-pointer flex-col rounded-xl border border-border/80 bg-surface-elevated/60 p-3 transition-colors hover:border-border-strong hover:bg-surface-elevated/80"
        aria-label="Open calendar"
      >
        <MonthCalendarGrid
          size="sm"
          {...gridProps}
          enlargeHint
          onEnlargeHintClick={() => setOpen(true)}
        />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Calendar"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={close}
            aria-label="Close calendar"
          />
          <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Calendar</h2>
                <p className="text-xs text-muted">
                  {format(cal.selected, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              <button
                type="button"
                data-cal-interactive
                onClick={close}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <MonthCalendarGrid size="lg" {...gridProps} />

              <DayEventsList
                events={selectedDayEvents}
                editingId={editingEvent?.id}
                onEdit={setEditingEvent}
                onChanged={() => {
                  setEditingEvent(null);
                  onEventsChanged();
                }}
              />

              {editingEvent && (
                <div className="mt-5 border-t border-border pt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                    Edit event
                  </p>
                  <EventForm
                    selectedDate={cal.selected}
                    event={editingEvent}
                    onSaved={onEventSaved}
                    onCancel={() => setEditingEvent(null)}
                  />
                </div>
              )}

              <div className="mt-6 border-t border-border pt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                  {editingEvent ? "Or add another" : "New event"}
                </p>
                <EventForm selectedDate={cal.selected} onSaved={onEventsChanged} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
