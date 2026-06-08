import { PageHeader } from "@/components/ui/PageHeader";
import { TierlistsView } from "@/components/tierlists/TierlistsView";
import { sortPlayersByRoster } from "@/lib/player-sort";
import {
  attachPlayersToTierlists,
  listActivePlayers,
  listAllTierlists,
} from "@/lib/tierlist-db";

export const dynamic = "force-dynamic";

export default async function TierlistsPage() {
  const [tierlists, players] = await Promise.all([
    listAllTierlists(),
    listActivePlayers(),
  ]);

  const sortedPlayers = sortPlayersByRoster(players);
  const withPlayers = attachPlayersToTierlists(tierlists, sortedPlayers);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tierlists"
        description="Per-player champion rankings for meta, scrims, and patch planning"
      />

      <TierlistsView
        players={sortedPlayers}
        tierlists={withPlayers.map((t) => ({
          id: t.id,
          name: t.name,
          rows: t.rows,
          updatedAt: t.updatedAt.toISOString(),
          playerId: t.playerId,
          player: t.player,
        }))}
      />
    </div>
  );
}
