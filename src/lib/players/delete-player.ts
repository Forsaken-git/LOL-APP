import { removePlayerFromTrackingFiles } from "@/lib/roster-sync";
import { prisma } from "@/lib/prisma";

export async function deletePlayer(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] } },
  });
  if (!player) {
    throw new Error("Player not found");
  }

  const removedParticipations = await prisma.$transaction(async (tx) => {
    await tx.match.updateMany({
      where: { mvpId: playerId },
      data: { mvpId: null },
    });
    const parts = await tx.matchParticipant.deleteMany({ where: { playerId } });
    await tx.availabilitySlot.deleteMany({ where: { playerId } });
    await tx.tierlist.deleteMany({ where: { playerId } });
    await tx.playerAccount.deleteMany({ where: { playerId } });
    await tx.player.delete({ where: { id: playerId } });
    return parts.count;
  });

  const summonerNames = [
    ...player.accounts.map((a) => a.summonerName),
    ...(player.summonerName ? [player.summonerName] : []),
  ];

  const tracking = removePlayerFromTrackingFiles({
    displayName: player.displayName,
    externalId: player.externalId,
    summonerNames,
  });

  return {
    id: player.id,
    displayName: player.displayName,
    removedParticipations,
    tracking,
  };
}
