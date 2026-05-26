"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DAY_STATE_STYLES,
  dayTint,
  dotKinds,
  isSameCalendarDay,
  MARKER_STYLES,
  type DayMarker,
  type LegendItem,
} from "@/lib/calendar-markers";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const SIZE = {
  sm: {
    weekday: "text-[10px] pb-1.5 text-faint",
    day: "min-h-[2rem] rounded-md py-1 text-xs text-muted",
    dot: "h-1.5 w-1.5",
    gap: "gap-0.5",
    legend: "text-[10px] gap-x-3",
  },
  lg: {
    weekday: "text-[11px] pb-2 text-faint",
    day: "min-h-[3.25rem] rounded-lg py-1.5 text-sm text-muted",
    dot: "h-2 w-2",
    gap: "gap-1",
    legend: "text-[11px] gap-x-4",
  },
} as const;

export function MonthCalendarGrid({
  size,
  viewDate,
  selected,
  hovered,
  onSelect,
  onHover,
  onPrevMonth,
  onNextMonth,
  markerFor,
  legend,
  loading,
  enlargeHint,
  onEnlargeHintClick,
}: {
  size: keyof typeof SIZE;
  viewDate: Date;
  selected: Date;
  hovered: Date | null;
  onSelect: (day: Date) => void;
  onHover: (day: Date | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  markerFor: (day: Date) => DayMarker | undefined;
  legend: LegendItem[];
  loading: boolean;
  enlargeHint?: boolean;
  onEnlargeHintClick?: () => void;
}) {
  const s = SIZE[size];
  const monthStart = startOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(viewDate) });
  const pad = (monthStart.getDay() + 6) % 7;
  const today = new Date();

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          data-cal-interactive
          onClick={onPrevMonth}
          className="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className={`font-semibold text-foreground ${size === "lg" ? "text-base" : "text-sm"}`}>
            {format(viewDate, "MMMM yyyy")}
          </p>
          {enlargeHint && onEnlargeHintClick && (
            <button
              type="button"
              data-cal-interactive
              onClick={onEnlargeHintClick}
              className="text-[10px] text-faint transition-colors hover:text-muted"
            >
              Enlarge
            </button>
          )}
        </div>
        <button
          type="button"
          data-cal-interactive
          onClick={onNextMonth}
          className="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`grid grid-cols-7 ${s.gap} text-center ${loading ? "opacity-50" : ""}`}
      >
        {WEEKDAYS.map((d) => (
          <div key={d} className={s.weekday}>
            {d}
          </div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-${i}`} aria-hidden />
        ))}
        {days.map((day) => {
          const m = markerFor(day);
          const isSelected = isSameCalendarDay(day, selected);
          const isHovered = hovered !== null && isSameCalendarDay(day, hovered);
          const isToday = isSameDay(day, today);
          const kinds = dotKinds(m);
          const tint = dayTint(m);

          return (
            <button
              key={day.toISOString()}
              type="button"
              data-cal-interactive
              onClick={() => onSelect(day)}
              onMouseEnter={() => onHover(day)}
              onMouseLeave={() => onHover(null)}
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              className={[
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                s.day,
                tint,
                isSelected && DAY_STATE_STYLES.selected.day,
                isHovered && !isSelected && "bg-white/[0.06]",
                isToday && DAY_STATE_STYLES.today.day,
                !isToday && !isSelected && "hover:text-foreground",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="leading-none tabular-nums">{format(day, "d")}</span>
              <span
                className="flex h-1.5 items-center justify-center gap-px"
                aria-hidden
              >
                {kinds.length > 0 ? (
                  kinds.map((kind) => (
                    <span
                      key={kind}
                      className={`rounded-full ${s.dot} ${MARKER_STYLES[kind].dot}`}
                    />
                  ))
                ) : (
                  <span className={`${s.dot} opacity-0`} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`mt-2.5 flex flex-wrap items-center justify-center border-t border-border/60 pt-2.5 ${s.legend} text-muted`}
      >
        {legend.map(({ kind, label }) => (
          <span key={kind} className="inline-flex items-center gap-1">
            <span className={`rounded-full ${s.dot} ${MARKER_STYLES[kind].dot}`} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span
            className={`rounded-sm ${size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5"} ${DAY_STATE_STYLES.today.day}`}
            aria-hidden
          />
          {DAY_STATE_STYLES.today.label}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className={`rounded-sm ${size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5"} ${DAY_STATE_STYLES.selected.day}`}
            aria-hidden
          />
          {DAY_STATE_STYLES.selected.label}
        </span>
      </div>
    </>
  );
}
