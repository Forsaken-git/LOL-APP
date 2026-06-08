import nextDynamic from "next/dynamic";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { buildPlayerProfile } from "@/lib/player-stats";
import type { PlayerProfile } from "@/lib/player-profile-types";
import { sortPlayersByRoster } from "@/lib/player-sort";
import { listAllTierlists } from "@/lib/tierlist-db";

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

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [rows, tierlistRows] = await Promise.all([
    prisma.player.findMany({
      where: { active: true },
      include: {
        participations: {
          include: {
            match: { select: { playedAt: true, result: true } },
          },
        },
      },
    }),
    listAllTierlists(),
  ]);

  const players: PlayerProfile[] = sortPlayersByRoster(rows).map((player) =>
    buildPlayerProfile(player),
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

      <PlayersRoster players={players} tierlistsByPlayerId={tierlistsByPlayerId} />
    </div>
  );
}
