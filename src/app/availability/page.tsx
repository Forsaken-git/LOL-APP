import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleBoard } from "@/components/availability/ScheduleBoard";
import { formatWeekRange, getWeekStart, parseAvailability } from "@/lib/week";
import { sortPlayersByRoster } from "@/lib/player-sort";
import type { AvailabilityData } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const weekStart = getWeekStart();
  const weekStartIso = weekStart.toISOString();

  const [playerRows, slots] = await Promise.all([
    prisma.player.findMany({
      where: { active: true },
      select: {
        id: true,
        displayName: true,
        teamRole: true,
        memberRole: true,
      },
    }),
    prisma.availabilitySlot.findMany({
      where: { weekStart },
    }),
  ]);

  const players = sortPlayersByRoster(playerRows);
  const initialSlots: Record<string, AvailabilityData> = Object.fromEntries(
    slots.map((s) => [s.playerId, parseAvailability(s.slots)]),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Weekly Schedule"
        description="Tap cells to set availability — saves automatically"
      />

      <ScheduleBoard
        weekStartIso={weekStartIso}
        weekLabel={formatWeekRange(weekStart)}
        players={players}
        initialSlots={initialSlots}
      />
    </div>
  );
}
