"use client";

import { useCallback, useEffect, useState } from "react";
import { format, subMonths, addMonths } from "date-fns";
import type { CalendarEvent, DayMarker, LegendItem } from "@/lib/calendar-markers";

export function useMonthCalendar(initialDate = new Date()) {
  const [viewDate, setViewDate] = useState(initialDate);
  const [selected, setSelected] = useState(initialDate);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [markers, setMarkers] = useState<Map<string, DayMarker>>(new Map());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [legend, setLegend] = useState<LegendItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMonth = useCallback(async (date: Date) => {
    setLoading(true);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    try {
      const res = await fetch(`/api/calendar/month?year=${y}&month=${m}`);
      if (!res.ok) throw new Error("Failed to load calendar");
      const data = (await res.json()) as {
        days: DayMarker[];
        legend: LegendItem[];
        events: CalendarEvent[];
      };
      setMarkers(new Map(data.days.map((d) => [d.date, d])));
      setLegend(data.legend);
      setEvents(data.events ?? []);
    } catch {
      setMarkers(new Map());
      setLegend([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonth(viewDate);
  }, [viewDate, loadMonth]);

  function markerFor(day: Date): DayMarker | undefined {
    return markers.get(format(day, "yyyy-MM-dd"));
  }

  return {
    viewDate,
    setViewDate,
    selected,
    setSelected,
    hovered,
    setHovered,
    events,
    legend,
    loading,
    markerFor,
    reload: () => loadMonth(viewDate),
    prevMonth: () => setViewDate((d) => subMonths(d, 1)),
    nextMonth: () => setViewDate((d) => addMonths(d, 1)),
  };
}
