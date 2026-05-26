/**
 * Remove demo seed matches (no ingest source). Keeps import-* matches.
 *
 *   npx tsx scripts/clean-demo-matches.ts
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  const demo = await prisma.match.findMany({
    where: { source: null },
    select: { id: true, league: true, opponent: true },
  });

  if (demo.length === 0) {
    console.log("No demo matches to remove.");
    return;
  }

  for (const m of demo) {
    await prisma.pickBan.deleteMany({ where: { matchId: m.id } });
    await prisma.matchParticipant.deleteMany({ where: { matchId: m.id } });
    await prisma.match.delete({ where: { id: m.id } });
    console.log(`Removed: ${m.league} vs ${m.opponent ?? "?"}`);
  }

  const demoEventTitles = [
    "CWL — vs Phoenix Esports",
    "Titans League — match day",
    "Team scrim block",
    "VOD review — drafts",
  ];
  const events = await prisma.event.deleteMany({
    where: { title: { in: demoEventTitles } },
  });
  if (events.count > 0) {
    console.log(`Removed ${events.count} demo calendar event(s).`);
  }

  console.log(`Done. Removed ${demo.length} demo match(es).`);
}

main().finally(() => prisma.$disconnect());
