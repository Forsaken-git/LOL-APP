/**
 * One-off: write our-team PICK rows for every played match that has roster participants.
 * Run: npx tsx scripts/backfill-our-pick-bans.ts
 */
import { prisma } from "../src/lib/prisma";
import { ensureOurTeamPickBans } from "../src/lib/matches/sync-our-pick-bans";

async function main() {
  const matches = await prisma.match.findMany({
    where: { status: "PLAYED" },
    select: { id: true, league: true, opponent: true },
  });

  for (const m of matches) {
    await ensureOurTeamPickBans(m.id);
    const picks = await prisma.pickBan.count({
      where: { matchId: m.id, type: "PICK" },
    });
    console.log(`${m.league} vs ${m.opponent ?? "?"} — ${picks} pick row(s)`);
  }

  console.log(`Done. ${matches.length} played match(es) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
