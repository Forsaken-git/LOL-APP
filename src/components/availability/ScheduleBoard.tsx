"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  GRID_HOURS,
  clearGrid,
  countDaysWithHours,
  countSelectedHours,
  emptyAvailability,
  formatHour,
  isDayAvailable,
  isHourSelected,
  playersFreeOnDay,
  setHourRange,
  teamHourCounts,
  toggleHour,
  WEEKDAYS,
  type AvailabilityData,
  type Weekday,
} from "@/lib/availability";
import { formatTeamRole } from "@/lib/player-stats";
import { parseAvailability } from "@/lib/week";
import type { LoLRole, UserRole } from "@prisma/client";

const PLAYER_STORAGE_KEY = "renim-availability-player";

export type SchedulePlayer = {
  id: string;
  displayName: string;
  teamRole: LoLRole;
  memberRole: UserRole;
};

type BoardState = Record<string, AvailabilityData>;
type ViewMode = "mine" | "team";
type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  const [view, setView] = useState<ViewMode>("mine");
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

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
    if (players.length === 0) return;
    const stored = localStorage.getItem(PLAYER_STORAGE_KEY);
    const match = stored ? players.find((p) => p.id === stored) : null;
    setSelectedPlayerId(match?.id ?? players[0]!.id);
  }, [players]);

  useEffect(() => {
    for (const t of saveTimers.current.values()) clearTimeout(t);
    saveTimers.current.clear();
    setSaveStatus({});
  }, [weekStart]);

  const loadWeek = useCallback(
    async (iso: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/availability?weekStart=${encodeURIComponent(iso)}`,
        );
        if (!res.ok) throw new Error("Failed to load week");
        const rows = (await res.json()) as { playerId: string; slots: string }[];
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
    },
    [players],
  );

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

  const selectPlayer = useCallback((id: string) => {
    setSelectedPlayerId(id);
    localStorage.setItem(PLAYER_STORAGE_KEY, id);
  }, []);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? players[0];
  const mySlots = selectedPlayer
    ? (board[selectedPlayer.id] ?? emptyAvailability())
    : emptyAvailability();

  const overview = useMemo(() => {
    return WEEKDAYS.map((day, i) => {
      const available = playersFreeOnDay(board, players, day);
      return { day, date: dayDates[i], available, total: players.length };
    });
  }, [board, players, dayDates]);

  const hourCounts = useMemo(
    () => teamHourCounts(board, players),
    [board, players],
  );

  const bestDay = overview.reduce((best, cur) =>
    cur.available.length > best.available.length ? cur : best,
  );

  const weekRangeLabel =
    weekStart === weekStartIso
      ? weekLabel
      : `${format(weekStartDate, "MMM d")} – ${format(addDays(weekStartDate, 6), "MMM d, yyyy")}`;

  const mySave = selectedPlayer ? (saveStatus[selectedPlayer.id] ?? "idle") : "idle";
  const daysFilled = countDaysWithHours(mySlots);
  const hoursFilled = countSelectedHours(mySlots);

  return (
    <div className="space-y-6">
      <WeekNav
        label={weekRangeLabel}
        loading={loading}
        onPrev={() => shiftWeek(-1)}
        onNext={() => shiftWeek(1)}
      />

      <div className="flex flex-wrap gap-2">
        <ViewTab active={view === "mine"} onClick={() => setView("mine")}>
          My week
        </ViewTab>
        <ViewTab active={view === "team"} onClick={() => setView("team")}>
          <Users className="h-3.5 w-3.5" />
          Team overview
        </ViewTab>
      </div>

      {view === "mine" && selectedPlayer && (
        <Card className="!overflow-visible !border-white/[0.05] !p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] px-4 py-3">
            <PlayerPickerCompact
              players={players}
              board={board}
              selectedId={selectedPlayer.id}
              onSelect={selectPlayer}
            />
            <SaveBadge
              status={mySave}
              daysFilled={daysFilled}
              hoursFilled={hoursFilled}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/[0.04] px-4 py-2">
            <QuickBtn
              label="Mon–Fri 18–22"
              onClick={() =>
                updatePlayer(selectedPlayer.id, (data) =>
                  setHourRange(
                    data,
                    ["monday", "tuesday", "wednesday", "thursday", "friday"],
                    18,
                    22,
                    true,
                  ),
                )
              }
            />
            <QuickBtn
              label="Clear all"
              onClick={() =>
                updatePlayer(selectedPlayer.id, (data) => clearGrid(data))
              }
            />
          </div>

          <TimeGrid
            data={mySlots}
            dayDates={dayDates}
            onChange={(updater) =>
              updatePlayer(selectedPlayer.id, updater)
            }
          />
        </Card>
      )}

      {view === "team" && (
        <>
          <Card title="Best scrim day">
            <p className="mb-4 text-sm text-muted">
              Most players free on{" "}
              <span className="font-semibold capitalize text-accent-bright">
                {bestDay.day}
              </span>{" "}
              ({bestDay.available.length}/{bestDay.total})
            </p>
            <div className="grid gap-2 sm:grid-cols-7">
              {overview.map(({ day, date, available, total }) => {
                const pct = total > 0 ? available.length / total : 0;
                const isBest = day === bestDay.day && available.length > 0;
                return (
                  <div
                    key={day}
                    className={`relative overflow-hidden rounded-xl border p-3 text-center transition-colors ${
                      isBest
                        ? "border-accent/50 bg-accent/10"
                        : "border-border bg-inset/60"
                    }`}
                  >
                    {isBest && (
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-bright" />
                    )}
                    <p className="text-xs font-medium text-accent-bright">
                      {format(date, "EEE")}
                    </p>
                    <p className="text-[10px] text-faint">{format(date, "d MMM")}</p>
                    <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
                      {available.length}
                      <span className="text-sm font-normal text-muted">/{total}</span>
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-emerald-500/70 transition-all"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 truncate text-[10px] text-faint">
                      {available.map((p) => p.displayName.split(" ")[0]).join(", ") ||
                        "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <button
            type="button"
            onClick={() => setHeatmapOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface/80 px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <span>Team availability heatmap</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${heatmapOpen ? "rotate-180" : ""}`}
            />
          </button>

          {heatmapOpen && (
            <Card title="Who is free when">
              <p className="mb-3 text-xs text-muted">
                Darker green = more players available. Click a player in My week to
                edit your grid.
              </p>
              <TeamHeatmap
                hourCounts={hourCounts}
                dayDates={dayDates}
                playerCount={players.length}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TimeGrid({
  data,
  dayDates,
  onChange,
}: {
  data: AvailabilityData;
  dayDates: Date[];
  onChange: (updater: (prev: AvailabilityData) => AvailabilityData) => void;
}) {
  const paintRef = useRef<{ active: boolean; on: boolean } | null>(null);

  const applyCell = useCallback(
    (day: Weekday, hour: number, on: boolean) => {
      onChange((prev) => toggleHour(prev, day, hour, on));
    },
    [onChange],
  );

  const startPaint = (day: Weekday, hour: number) => {
    const on = !isHourSelected(data, day, hour);
    paintRef.current = { active: true, on };
    applyCell(day, hour, on);
  };

  const continuePaint = (day: Weekday, hour: number) => {
    if (!paintRef.current?.active) return;
    applyCell(day, hour, paintRef.current.on);
  };

  const endPaint = () => {
    paintRef.current = null;
  };

  useEffect(() => {
    const stop = () => endPaint();
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  return (
    <div className="schedule-scroll overflow-x-auto p-2 sm:p-3">
      <table className="w-full min-w-[24rem] border-separate border-spacing-1 select-none sm:min-w-[28rem]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-11 bg-surface p-0" />
            {WEEKDAYS.map((day, i) => {
              const date = dayDates[i]!;
              return (
                <th
                  key={day}
                  className="pb-2 text-center align-middle text-[11px] font-medium text-muted"
                >
                  {format(date, "EEE")}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {GRID_HOURS.map((hour) => (
            <tr key={hour}>
              <td className="sticky left-0 z-10 w-11 bg-surface py-0 pr-2 text-right align-middle text-[10px] tabular-nums leading-none text-muted">
                {formatHour(hour)}
              </td>
              {WEEKDAYS.map((day) => {
                const on = isHourSelected(data, day, hour);
                return (
                  <td key={day} className="p-0.5 align-middle">
                    <button
                      type="button"
                      aria-pressed={on}
                      className="schedule-slot"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        startPaint(day, hour);
                      }}
                      onMouseEnter={() => continuePaint(day, hour)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        startPaint(day, hour);
                      }}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        if (!touch) return;
                        const el = document.elementFromPoint(
                          touch.clientX,
                          touch.clientY,
                        );
                        const btn = el?.closest<HTMLButtonElement>(
                          "button[data-hour][data-day]",
                        );
                        if (btn?.dataset.day && btn.dataset.hour) {
                          continuePaint(
                            btn.dataset.day as Weekday,
                            Number(btn.dataset.hour),
                          );
                        }
                      }}
                      data-day={day}
                      data-hour={hour}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-faint/80">
        Click or drag to mark free hours.
      </p>
    </div>
  );
}

function TeamHeatmap({
  hourCounts,
  dayDates,
  playerCount,
}: {
  hourCounts: Record<Weekday, Record<number, number>>;
  dayDates: Date[];
  playerCount: number;
}) {
  return (
    <div className="schedule-scroll overflow-x-auto -mx-4 px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[24rem] border-separate border-spacing-1 sm:min-w-[28rem]">
        <thead>
          <tr>
            <th className="w-11 p-0" />
            {WEEKDAYS.map((day, i) => (
              <th
                key={day}
                className="pb-2 text-center align-middle text-[11px] font-medium text-muted"
              >
                {format(dayDates[i]!, "EEE")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GRID_HOURS.map((hour) => (
            <tr key={hour}>
              <td className="py-0 pr-2 text-right align-middle text-[10px] tabular-nums leading-none text-muted">
                {formatHour(hour)}
              </td>
              {WEEKDAYS.map((day) => {
                const count = hourCounts[day][hour] ?? 0;
                const intensity = playerCount > 0 ? count / playerCount : 0;
                const filled = count > 0;
                return (
                  <td key={day} className="p-0.5 align-middle">
                    <div
                      className={`schedule-slot schedule-slot--heatmap ${
                        filled ? "schedule-slot--filled" : ""
                      }`}
                      style={
                        filled
                          ? {
                              backgroundColor: `rgba(26, ${Math.round(61 + intensity * 30)}, ${Math.round(48 + intensity * 20)}, ${0.55 + intensity * 0.35})`,
                            }
                          : undefined
                      }
                      title={`${count} player${count === 1 ? "" : "s"}`}
                    >
                      {filled ? count : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerPickerCompact({
  players,
  board,
  selectedId,
  onSelect,
}: {
  players: SchedulePlayer[];
  board: BoardState;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        Player
      </span>
      {players.map((p) => {
        const active = p.id === selectedId;
        const filled = countDaysWithHours(board[p.id] ?? emptyAvailability());
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            title={`${formatTeamRole(p.teamRole)} · ${filled}/7 days`}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-accent/20 text-accent-bright"
                : "text-muted hover:bg-white/[0.05] hover:text-foreground"
            }`}
          >
            {p.displayName}
          </button>
        );
      })}
    </div>
  );
}

function WeekNav({
  label,
  loading,
  onPrev,
  onNext,
}: {
  label: string;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-ghost flex h-9 w-9 items-center justify-center !p-0"
        onClick={onPrev}
        disabled={loading}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="min-w-[10rem] flex-1 text-center text-sm font-semibold text-foreground">
        {label}
        {loading && <span className="ml-2 text-xs font-normal text-muted">…</span>}
      </p>
      <button
        type="button"
        className="btn-ghost flex h-9 w-9 items-center justify-center !p-0"
        onClick={onNext}
        disabled={loading}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
        active
          ? "bg-accent/20 text-accent-bright"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      {label}
    </button>
  );
}

function SaveBadge({
  status,
  daysFilled,
  hoursFilled,
}: {
  status: SaveStatus;
  daysFilled: number;
  hoursFilled: number;
}) {
  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed"
          : null;

  return (
    <div className="text-right text-[11px]">
      <p className="text-muted">
        {daysFilled} days · {hoursFilled}h marked
      </p>
      {statusText && (
        <p
          className={
            status === "error"
              ? "text-rose-400"
              : status === "saved"
                ? "text-emerald-400"
                : "text-amber-400"
          }
        >
          {statusText}
        </p>
      )}
    </div>
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
  return parseAvailability(json);
}
