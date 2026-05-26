/**
 * Remove matches imported from game_data JSONL (source import-*).
 *
 *   npx tsx scripts/rollback-jsonl-import.ts
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  const imported = await prisma.match.findMany({
    where: { source: { startsWith: "import-" } },
    select: { id: true, league: true, opponent: true, source: true },
  });

  if (imported.length === 0) {
    console.log("No import-* matches to remove.");
    return;
  }

  for (const m of imported) {
    await prisma.pickBan.deleteMany({ where: { matchId: m.id } });
    await prisma.matchParticipant.deleteMany({ where: { matchId: m.id } });
    await prisma.match.delete({ where: { id: m.id } });
    console.log(`Removed: ${m.source} · ${m.league} vs ${m.opponent ?? "?"}`);
  }

  console.log(`\nRemoved ${imported.length} imported match(es).`);
  console.log(
    "LCU JSONL folders (CWL/, Scrims/, etc.) are unchanged on disk — only DB rows were cleared.",
  );
}

main().finally(() => prisma.$disconnect());
