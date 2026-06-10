import {
  removePlayerFromTrackingFiles,
  syncPlayerToTrackingFiles,
} from "@/lib/roster-sync";
import { prisma } from "@/lib/prisma";
import { primarySummonerName } from "@/lib/player-accounts-shared";
import { rosterExternalId } from "@/lib/team-roster";

export async function setPlayerActive(playerId: string, active: boolean) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] } },
  });
  if (!player) {
    throw new Error("Player not found");
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { active },
  });

  const summonerNames = [
    ...player.accounts.map((a) => a.summonerName),
    ...(player.summonerName ? [player.summonerName] : []),
  ];

  const tracking = active
    ? (() => {
        const west =
          player.accounts.find((a) => a.region === "WEST")?.summonerName ??
          player.summonerName;
        if (!west) return null;
        return syncPlayerToTrackingFiles({
          displayName: player.displayName,
          summonerName: west,
          teamRole: player.teamRole,
          memberRole: player.memberRole,
          externalId:
            player.externalId ??
            rosterExternalId({
              displayName: player.displayName,
              summonerName: west,
            }),
        });
      })()
    : removePlayerFromTrackingFiles({
        displayName: player.displayName,
        externalId: player.externalId,
        summonerNames,
      });

  return {
    id: player.id,
    displayName: player.displayName,
    active,
    summonerName: primarySummonerName(
      player.accounts.map((a) => ({
        region: a.region,
        summonerName: a.summonerName,
      })),
      player.summonerName,
    ),
    tracking,
  };
}
