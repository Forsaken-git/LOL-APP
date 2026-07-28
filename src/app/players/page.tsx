import nextDynamic from "next/dynamic";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { buildPlayerRosterSummary } from "@/lib/player-stats";
import type { PlayerProfile } from "@/lib/player-profile-types";
import { mergeDuplicatePlayerRows } from "@/lib/player-dedupe";
import { sortPlayersByRoster } from "@/lib/player-sort";
import { listAllTierlists } from "@/lib/tierlist-db";
import {
  activeTeamPlayerWhere,
  hiddenTeamPlayerWhere,
} from "@/lib/players/team-player";

const PlayersRoster = nextDynamic(
  () =>
    import("@/components/players/PlayersRoster").then((mod) => mod.PlayersRoster),
  {
    loading: () => (
      <Card>
        <p className="text-sm text-muted">Loading roster…</p>
      </Card>
    ),
  },
);

/** Always fresh — roster mutations must show up immediately on Vercel. */
export const dynamic = "force-dynamic";

const rosterParticipationSelect = {
  matchId: true,
  champion: true,
  side: true,
  position: true,
  match: { select: { playedAt: true, result: true, side: true } },
} satisfies Prisma.MatchParticipantSelect;

const playerInclude = {
  accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] },
  participations: { select: rosterParticipationSelect },
} satisfies Prisma.PlayerInclude;

export default async function PlayersPage() {
  const [activeRows, formerRows, tierlistRows] = await Promise.all([
    prisma.player.findMany({
      where: activeTeamPlayerWhere,
      include: playerInclude,
    }),
    prisma.player.findMany({
      where: hiddenTeamPlayerWhere,
      include: playerInclude,
      orderBy: { displayName: "asc" },
    }),
    listAllTierlists(),
  ]);

  const players: PlayerProfile[] = sortPlayersByRoster(
    mergeDuplicatePlayerRows(activeRows),
  ).map((player) => buildPlayerRosterSummary(player));

  const formerPlayers: PlayerProfile[] = mergeDuplicatePlayerRows(formerRows).map(
    (player) => buildPlayerRosterSummary(player),
  );

  const tierlistsByPlayerId: Record<
    string,
    { id: string; name: string; updatedAt: string }[]
  > = {};
  for (const t of tierlistRows) {
    if (!t.playerId) continue;
    const list = tierlistsByPlayerId[t.playerId] ?? [];
    list.push({
      id: t.id,
      name: t.name,
      updatedAt: t.updatedAt.toISOString(),
    });
    tierlistsByPlayerId[t.playerId] = list;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Players"
        description="Active roster — click a player for champion pool and stats"
      />

      <PlayersRoster
        players={players}
        formerPlayers={formerPlayers}
        tierlistsByPlayerId={tierlistsByPlayerId}
      />
    </div>
  );
}
