import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleBoard } from "@/components/availability/ScheduleBoard";
import { formatWeekRange, getWeekStart, parseAvailability } from "@/lib/week";
import { sortPlayersByRoster } from "@/lib/player-sort";
import type { AvailabilityData } from "@/lib/week";
import { activeTeamPlayerWhere } from "@/lib/players/team-player";
import { getSession } from "@/lib/auth/session";
import {
  canManageAllSchedules,
  resolveOwnPlayerId,
} from "@/lib/auth/schedule-access";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const weekStart = getWeekStart();
  const weekStartIso = weekStart.toISOString();
  const session = await getSession();

  const [playerRows, slots, ownPlayerId] = await Promise.all([
    prisma.player.findMany({
      where: activeTeamPlayerWhere,
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
    session ? resolveOwnPlayerId(session) : Promise.resolve(null),
  ]);

  const players = sortPlayersByRoster(playerRows);
  const initialSlots: Record<string, AvailabilityData> = Object.fromEntries(
    slots.map((s) => [s.playerId, parseAvailability(s.slots)]),
  );

  const canEditAll = session ? canManageAllSchedules(session.role) : false;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Schedule"
        description={
          canEditAll
            ? "Fill free hours in your browser’s local time — saved as team time (CEST). Analytics can edit any player."
            : "Fill free hours in your browser’s local time — saved as team time (CEST) for the heatmap."
        }
      />

      <ScheduleBoard
        weekStartIso={weekStartIso}
        weekLabel={formatWeekRange(weekStart)}
        players={players}
        initialSlots={initialSlots}
        ownPlayerId={ownPlayerId}
        canEditAll={canEditAll}
      />
    </div>
  );
}
