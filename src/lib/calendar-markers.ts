import { format, isSameDay, parseISO } from "date-fns";

/** Calendar marker kinds (may differ from raw Prisma EventType). */
export type MarkerKind = "prime" | "scrim" | "played";

export type DayMarker = {
  date: string;
  kinds: MarkerKind[];
};

export type LegendItem = {
  kind: MarkerKind;
  label: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  startAt: string;
};

export const MARKER_STYLES: Record<
  MarkerKind,
  { dot: string; tint: string; chip: string; label: string }
> = {
  prime: {
    dot: "bg-orange-400 ring-1 ring-orange-300/40 shadow-[0_0_5px_rgba(251,146,60,0.45)]",
    tint: "bg-orange-500/22",
    chip: "border-orange-400/50 bg-orange-400/15 text-foreground",
    label: "Prime League",
  },
  scrim: {
    dot: "bg-cyan-400 ring-1 ring-cyan-400/25",
    tint: "bg-cyan-400/[0.07]",
    chip: "border-cyan-500/35 bg-cyan-500/12 text-foreground",
    label: "scrims",
  },
  played: {
    dot: "bg-emerald-400 ring-1 ring-emerald-300/35 shadow-[0_0_5px_rgba(52,211,153,0.45)]",
    tint: "bg-emerald-500/[0.11]",
    chip: "border-emerald-500/40 bg-emerald-500/15 text-foreground",
    label: "played",
  },
};

const LEGEND_ORDER: MarkerKind[] = ["played", "prime", "scrim"];

const KIND_PRIORITY: MarkerKind[] = ["played", "prime", "scrim"];

export const DAY_STATE_STYLES = {
  today: {
    day: "font-semibold text-foreground bg-white/[0.06] ring-1 ring-inset ring-white/25",
    label: "today",
  },
  selected: {
    day: "bg-accent/12 ring-1 ring-inset ring-accent/40",
    label: "selected",
  },
} as const;

export function eventTypeToMarkerKind(type: string): MarkerKind {
  switch (type) {
    case "PLAYED_MATCH":
      return "played";
    case "SCRIM":
    case "TRAINING":
      return "scrim";
    case "CWL":
    case "TITANS":
    case "MATCH":
    case "OTHER":
    default:
      return "prime";
  }
}

export function eventTypeLabel(type: string): string {
  if (type === "PLAYED_MATCH") return "Played";
  if (type === "SCRIM" || type === "TRAINING") return "SCRIMS";
  if (type === "CWL" || type === "TITANS") return "Prime League";
  if (type === "OTHER" || type === "MATCH") return "Prime League";
  return "Prime League";
}

export function buildMonthMarkers(events: CalendarEvent[]): Map<string, DayMarker> {
  const byDate = new Map<string, DayMarker>();

  for (const event of events) {
    const day = format(parseISO(event.startAt), "yyyy-MM-dd");
    let m = byDate.get(day);
    if (!m) {
      m = { date: day, kinds: [] };
      byDate.set(day, m);
    }
    const kind = eventTypeToMarkerKind(event.type);
    if (!m.kinds.includes(kind)) m.kinds.push(kind);
  }

  return byDate;
}

export function legendForMonth(markers: Map<string, DayMarker>): LegendItem[] {
  const kinds = new Set<MarkerKind>();
  for (const m of markers.values()) {
    for (const k of m.kinds) kinds.add(k);
  }
  return LEGEND_ORDER.filter((k) => kinds.has(k)).map((kind) => ({
    kind,
    label: MARKER_STYLES[kind].label,
  }));
}

export function dotKinds(marker: DayMarker | undefined): MarkerKind[] {
  if (!marker?.kinds.length) return [];
  return KIND_PRIORITY.filter((k) => marker.kinds.includes(k));
}

export function primaryKind(marker: DayMarker | undefined): MarkerKind | null {
  const kinds = dotKinds(marker);
  return kinds[0] ?? null;
}

export function dayTint(marker: DayMarker | undefined): string {
  const kind = primaryKind(marker);
  if (!kind) return "";
  return MARKER_STYLES[kind].tint;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = format(day, "yyyy-MM-dd");
  return events.filter((e) => format(parseISO(e.startAt), "yyyy-MM-dd") === key);
}
