import { notFound } from "next/navigation";
import { getChampionRoleData } from "@/lib/champion-roles";
import { parseTierlistRows } from "@/lib/tierlist";
import { sortPlayersByRoster } from "@/lib/player-sort";
import { getTierlistById, listActivePlayers } from "@/lib/tierlist-db";
import { TierlistEditor } from "@/components/tierlists/TierlistEditor";

export const dynamic = "force-dynamic";

export default async function TierlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tierlist, championRoleData, players] = await Promise.all([
    getTierlistById(id),
    getChampionRoleData(),
    listActivePlayers(),
  ]);
  if (!tierlist) notFound();

  const initialData = parseTierlistRows(tierlist.rows);

  return (
    <TierlistEditor
      id={tierlist.id}
      name={tierlist.name}
      initialData={initialData}
      initialPlayerId={tierlist.playerId}
      players={sortPlayersByRoster(players)}
      championRoleData={championRoleData}
    />
  );
}
