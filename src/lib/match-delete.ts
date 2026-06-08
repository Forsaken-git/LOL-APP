import { prisma } from "@/lib/prisma";

/** Delete match row and related pick/ban + participant rows (SQLite FK cascade is unreliable). */
export async function deleteMatchById(matchId: string) {
  await prisma.$transaction([
    prisma.pickBan.deleteMany({ where: { matchId } }),
    prisma.matchParticipant.deleteMany({ where: { matchId } }),
    prisma.match.delete({ where: { id: matchId } }),
  ]);
}

/** Remove pick/ban rows whose match was deleted outside cascade. */
export async function pruneOrphanPickBans() {
  const matchIds = (
    await prisma.match.findMany({ select: { id: true } })
  ).map((m) => m.id);

  if (matchIds.length === 0) {
    return prisma.pickBan.deleteMany();
  }

  return prisma.pickBan.deleteMany({
    where: { matchId: { notIn: matchIds } },
  });
}
