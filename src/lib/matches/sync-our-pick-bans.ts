import { prisma } from "@/lib/prisma";
import { ourTeamChampionNames } from "@/lib/matches/our-team-champions";

/**
 * Persist our team's played champions as PICK rows so pick/ban stats and
 * fearless draft pools count every game. Keeps our BANs and all enemy draft rows.
 */
export async function ensureOurTeamPickBans(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      pickBans: true,
      participants: { include: { player: { select: { active: true } } } },
    },
  });
  if (!match) return;

  const champions = ourTeamChampionNames(match.participants, match.side);
  if (champions.length === 0) return;

  const maxOrder = match.pickBans.reduce((m, pb) => Math.max(m, pb.order), -1);
  let order = maxOrder + 1;

  await prisma.pickBan.deleteMany({
    where: { matchId, side: match.side, type: "PICK" },
  });

  for (const champion of champions) {
    await prisma.pickBan.create({
      data: {
        matchId,
        champion,
        type: "PICK",
        side: match.side,
        order: order++,
      },
    });
  }
}
