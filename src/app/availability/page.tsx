import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  formatWeekRange,
  getWeekStart,
  parseAvailability,
  WEEKDAYS,
} from "@/lib/week";
import {
  AvailabilityEditor,
  AvailabilityEditorPlaceholder,
} from "@/components/availability/AvailabilityEditor";
import { sortPlayersByRoster } from "@/lib/player-sort";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const weekStart = getWeekStart();
  const weekStartIso = weekStart.toISOString();

  const [playerRows, slots] = await Promise.all([
    prisma.player.findMany({
      where: { active: true },
    }),
    prisma.availabilitySlot.findMany({
      where: { weekStart },
      include: { player: true },
    }),
  ]);

  const players = sortPlayersByRoster(playerRows);

  const slotByPlayer = new Map(slots.map((s) => [s.playerId, s]));

  const overview = WEEKDAYS.map((day) => {
    const available = players.filter((p) => {
      const slot = slotByPlayer.get(p.id);
      if (!slot) return false;
      const data = parseAvailability(slot.slots);
      const val = data[day]?.trim();
      return val && !val.toLowerCase().includes("busy");
    });
    return { day, available, total: players.length };
  });

  const bestDay = overview.reduce((best, cur) =>
    cur.available.length > best.available.length ? cur : best,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Weekly Schedule"
        description={`${formatWeekRange(weekStart)} — set your availability for scrims and meetings`}
      />

      <Card title="Team overview">
        <p className="mb-4 text-sm text-muted">
          Best overlap this week:{" "}
          <span className="font-medium capitalize text-accent-bright">
            {bestDay.day}
          </span>{" "}
          ({bestDay.available.length}/{bestDay.total} players with time listed)
        </p>
        <div className="grid gap-2 sm:grid-cols-7">
          {overview.map(({ day, available, total }) => (
            <div
              key={day}
              className="rounded-xl border border-border bg-inset p-3 text-center"
            >
              <p className="text-xs font-medium capitalize text-accent-bright">
                {day.slice(0, 3)}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {available.length}/{total}
              </p>
              <p className="mt-2 text-[10px] leading-tight text-muted">
                {available.map((p) => p.displayName).join(", ") || "—"}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
          Your availability
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {players.map((player) => {
            const slot = slotByPlayer.get(player.id);
            if (slot) {
              return (
                <AvailabilityEditor
                  key={player.id}
                  playerId={player.id}
                  playerName={player.displayName}
                  weekStart={weekStartIso}
                  initial={parseAvailability(slot.slots)}
                />
              );
            }
            return (
              <AvailabilityEditorPlaceholder
                key={player.id}
                playerId={player.id}
                playerName={player.displayName}
                weekStart={weekStartIso}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
