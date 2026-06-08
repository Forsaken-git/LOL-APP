"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  AVAILABILITY_PRESETS,
  applyPresetToDay,
  applyPresetToWeek,
  emptyAvailability,
  isSlotAvailable,
  resolveSlot,
  WEEKDAYS,
  type AvailabilityData,
  type PresetOption,
  type Weekday,
} from "@/lib/availability";
import { formatTeamRole } from "@/lib/player-stats";
import type { LoLRole, UserRole } from "@prisma/client";

export type SchedulePlayer = {
  id: string;
  displayName: string;
  teamRole: LoLRole;
  memberRole: UserRole;
};

type BoardState = Record<string, AvailabilityData>;

const CELL_STYLES: Record<string, string> = {
  unset: "bg-inset/60 text-faint border-border hover:border-border-strong",
  evening: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25",
  afternoon: "bg-sky-500/15 text-sky-300 border-sky-500/35 hover:bg-sky-500/25",
  allday: "bg-violet-500/15 text-violet-300 border-violet-500/35 hover:bg-violet-500/25",
  busy: "bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25",
  custom: "bg-amber-500/10 text-amber-200 border-amber-500/30 hover:bg-amber-500/20",
};

export function ScheduleBoard({
  weekStartIso,
  weekLabel,
  players,
  initialSlots,
}: {
  weekStartIso: string;
  weekLabel: string;
  players: SchedulePlayer[];
  initialSlots: Record<string, AvailabilityData>;
}) {
  const [weekStart, setWeekStart] = useState(weekStartIso);
  const [board, setBoard] = useState<BoardState>(() =>
    buildBoard(players, initialSlots),
  );
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const weekStartDate = useMemo(() => new Date(weekStart), [weekStart]);

  const dayDates = useMemo(
    () => WEEKDAYS.map((_, i) => addDays(weekStartDate, i)),
    [weekStartDate],
  );

  useEffect(() => {
    setBoard(buildBoard(players, initialSlots));
  }, [players, initialSlots]);

  useEffect(() => {
    for (const t of saveTimers.current.values()) clearTimeout(t);
    saveTimers.current.clear();
    setSaveStatus({});
  }, [weekStart]);

  const loadWeek = useCallback(async (iso: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/availability?weekStart=${encodeURIComponent(iso)}`);
      if (!res.ok) throw new Error("Failed to load week");
      const rows = (await res.json()) as {
        playerId: string;
        slots: string;
      }[];
      const byPlayer = new Map(
        rows.map((r) => [r.playerId, parseSlotsJson(r.slots)]),
      );
      setBoard(
        Object.fromEntries(
          players.map((p) => [p.id, byPlayer.get(p.id) ?? emptyAvailability()]),
        ),
      );
      setWeekStart(iso);
    } finally {
      setLoading(false);
    }
  }, [players]);

  const shiftWeek = useCallback(
    (delta: number) => {
      const next = addDays(new Date(weekStart), delta * 7).toISOString();
      void loadWeek(next);
    },
    [weekStart, loadWeek],
  );

  const persistPlayer = useCallback(
    (playerId: string, slots: AvailabilityData) => {
      const existing = saveTimers.current.get(playerId);
      if (existing) clearTimeout(existing);

      setSaveStatus((s) => ({ ...s, [playerId]: "saving" }));

      const timer = setTimeout(async () => {
        try {
          const res = await fetch("/api/availability", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, weekStart, slots }),
          });
          if (!res.ok) throw new Error("Save failed");
          setSaveStatus((s) => ({ ...s, [playerId]: "saved" }));
          setTimeout(() => {
            setSaveStatus((s) =>
              s[playerId] === "saved" ? { ...s, [playerId]: "idle" } : s,
            );
          }, 2000);
        } catch {
          setSaveStatus((s) => ({ ...s, [playerId]: "error" }));
        }
      }, 400);

      saveTimers.current.set(playerId, timer);
    },
    [weekStart],
  );

  const updatePlayer = useCallback(
    (playerId: string, updater: (prev: AvailabilityData) => AvailabilityData) => {
      setBoard((prev) => {
        const nextSlots = updater(prev[playerId] ?? emptyAvailability());
        const next = { ...prev, [playerId]: nextSlots };
        persistPlayer(playerId, nextSlots);
        return next;
      });
    },
    [persistPlayer],
  );

  const setCell = useCallback(
    (playerId: string, day: Weekday, value: string) => {
      updatePlayer(playerId, (data) => ({ ...data, [day]: value }));
    },
    [updatePlayer],
  );

  const applyRowPreset = useCallback(
    (playerId: string, preset: PresetOption) => {
      updatePlayer(playerId, (data) => applyPresetToWeek(data, preset));
    },
    [updatePlayer],
  );

  const applyColumnPreset = useCallback(
    (day: Weekday, preset: PresetOption) => {
      setBoard((prev) => {
        const next = { ...prev };
        for (const p of players) {
          next[p.id] = applyPresetToDay(prev[p.id] ?? emptyAvailability(), day, preset);
          persistPlayer(p.id, next[p.id]);
        }
        return next;
      });
    },
    [players, persistPlayer],
  );

  const overview = useMemo(() => {
    return WEEKDAYS.map((day, i) => {
      const available = players.filter((p) =>
        isSlotAvailable(board[p.id]?.[day] ?? ""),
      );
      return { day, date: dayDates[i], available, total: players.length };
    });
  }, [board, players, dayDates]);

  const bestDay = overview.reduce((best, cur) =>
    cur.available.length > best.available.length ? cur : best,
  );

  const weekRangeLabel =
    weekStart === weekStartIso
      ? weekLabel
      : `${format(weekStartDate, "MMM d")} – ${format(addDays(weekStartDate, 6), "MMM d, yyyy")}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost flex h-9 w-9 items-center justify-center !p-0"
            onClick={() => shiftWeek(-1)}
            disabled={loading}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[10rem] text-center text-sm font-medium text-foreground">
            {weekRangeLabel}
            {loading && (
              <span className="ml-2 text-xs text-muted">Loading…</span>
            )}
          </p>
          <button
            type="button"
            className="btn-ghost flex h-9 w-9 items-center justify-center !p-0"
            onClick={() => shiftWeek(1)}
            disabled={loading}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {AVAILABILITY_PRESETS.filter((p) => p.key !== "unset").map((p) => (
            <span
              key={p.key}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${CELL_STYLES[p.key]}`}
            >
              <span className="font-medium">{p.shortLabel}</span>
              <span className="text-faint">{p.label}</span>
            </span>
          ))}
        </div>
      </div>

      <Card title="Team overlap">
        <p className="mb-4 text-sm text-muted">
          Best day:{" "}
          <span className="font-medium capitalize text-accent-bright">
            {bestDay.day}
          </span>{" "}
          ({bestDay.available.length}/{bestDay.total} available)
        </p>
        <div className="grid gap-2 sm:grid-cols-7">
          {overview.map(({ day, date, available, total }) => (
            <button
              key={day}
              type="button"
              className="rounded-xl border border-border bg-inset p-3 text-center transition-colors hover:border-accent/40 hover:bg-accent/5"
              onClick={() => applyColumnPreset(day, AVAILABILITY_PRESETS[1])}
              title={`Set ${format(date, "EEE")} to evening for everyone`}
            >
              <p className="text-xs font-medium text-accent-bright">
                {format(date, "EEE")}
              </p>
              <p className="text-[10px] text-faint">{format(date, "d MMM")}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {available.length}/{total}
              </p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-faint">
          Tap a day above to set everyone to evening. Click cells below for per-player
          times.
        </p>
      </Card>

      <Card title="Weekly grid">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="table-head">
                <th className="sticky left-0 z-10 bg-surface pb-2 pr-3 text-left font-medium">
                  Player
                </th>
                {WEEKDAYS.map((day, i) => (
                  <th key={day} className="pb-2 px-0.5 text-center font-medium">
                    <ColumnHeader
                      label={format(dayDates[i], "EEE")}
                      sub={format(dayDates[i], "d")}
                      onPick={(preset) => applyColumnPreset(day, preset)}
                    />
                  </th>
                ))}
                <th className="pb-2 pl-2 text-left font-medium text-muted">Quick</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="table-row">
                  <td className="sticky left-0 z-10 bg-surface py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {player.displayName}
                        </p>
                        <p className="text-[10px] text-faint">
                          {formatTeamRole(player.teamRole)}
                        </p>
                      </div>
                      <SaveDot status={saveStatus[player.id] ?? "idle"} />
                    </div>
                  </td>
                  {WEEKDAYS.map((day) => (
                    <td key={day} className="py-2 px-0.5">
                      <ScheduleCell
                        value={board[player.id]?.[day] ?? ""}
                        onSelect={(value) => setCell(player.id, day, value)}
                      />
                    </td>
                  ))}
                  <td className="py-2 pl-2">
                    <RowQuickActions
                      onPreset={(preset) => applyRowPreset(player.id, preset)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScheduleCell({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const resolved = resolveSlot(value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const style = CELL_STYLES[resolved.key] ?? CELL_STYLES.unset;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full min-w-[3.25rem] items-center justify-center rounded-lg border text-xs font-semibold transition-all ${style}`}
        title={resolved.key === "custom" ? value : resolved.label}
      >
        {resolved.shortLabel}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-36 -translate-x-1/2 rounded-xl border border-border bg-surface-elevated p-1 shadow-xl">
          {AVAILABILITY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/5 ${
                resolveSlot(value).key === preset.key ? "bg-accent/15" : ""
              }`}
              onClick={() => {
                onSelect(preset.value);
                setOpen(false);
              }}
            >
              <span className="font-medium text-foreground">{preset.label}</span>
              <span className="text-faint">{preset.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnHeader({
  label,
  sub,
  onPick,
}: {
  label: string;
  sub: string;
  onPick: (preset: PresetOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg px-1 py-0.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        title="Set whole column"
      >
        <span className="block text-xs">{label}</span>
        <span className="block text-[10px] text-faint">{sub}</span>
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-36 -translate-x-1/2 rounded-xl border border-border bg-surface-elevated p-1 shadow-xl">
          {AVAILABILITY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-white/5"
              onClick={() => {
                onPick(preset);
                setOpen(false);
              }}
            >
              <span className="font-medium text-foreground">All {preset.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RowQuickActions({
  onPreset,
}: {
  onPreset: (preset: PresetOption) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
        onClick={() => onPreset(AVAILABILITY_PRESETS[1])}
        title="Evenings all week"
      >
        Eve
      </button>
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-[10px] text-muted hover:bg-white/5"
        onClick={() => onPreset(AVAILABILITY_PRESETS[0])}
        title="Clear week"
      >
        Clear
      </button>
      <button
        type="button"
        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-300 hover:bg-rose-500/20"
        onClick={() => onPreset(AVAILABILITY_PRESETS[4])}
        title="Busy all week"
      >
        Busy
      </button>
    </div>
  );
}

function SaveDot({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  const colors = {
    saving: "bg-amber-400 animate-pulse",
    saved: "bg-emerald-400",
    error: "bg-rose-400",
  };
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors[status]}`}
      title={status}
    />
  );
}

function buildBoard(
  players: SchedulePlayer[],
  initialSlots: Record<string, AvailabilityData>,
): BoardState {
  return Object.fromEntries(
    players.map((p) => [p.id, initialSlots[p.id] ?? emptyAvailability()]),
  );
}

function parseSlotsJson(json: string): AvailabilityData {
  try {
    const parsed = JSON.parse(json) as Partial<AvailabilityData>;
    return { ...emptyAvailability(), ...parsed };
  } catch {
    return emptyAvailability();
  }
}
