/**
 * Backfill missing trinketItemId on manual matches.
 * Run: npx tsx scripts/backfill-manual-trinkets.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  finalizeParticipantBuild,
  laneIndexFromPosition,
  scoreboardRoleForLaneIndex,
} from "../src/lib/build-normalize";
import type { ParticipantBuild } from "../src/lib/ingest/types";

const prisma = new PrismaClient();

async function main() {
  const parts = await prisma.matchParticipant.findMany({
    where: { match: { source: "manual" } },
    include: { match: { select: { id: true, opponent: true } } },
  });

  let updated = 0;
  for (const p of parts) {
    if (!p.buildJson) continue;
    let raw: ParticipantBuild;
    try {
      raw = JSON.parse(p.buildJson) as ParticipantBuild;
    } catch {
      continue;
    }
    if (raw.trinketItemId != null) continue;

    const laneIndex = laneIndexFromPosition(p.position);
    const finalized = finalizeParticipantBuild(raw, {
      position: p.position,
      laneIndex,
      scoreboardRole: scoreboardRoleForLaneIndex(laneIndex),
    });
    if (!finalized?.trinketItemId) continue;

    await prisma.matchParticipant.update({
      where: { id: p.id },
      data: { buildJson: JSON.stringify(finalized) },
    });
    updated++;
    console.log(`  ${p.match.opponent} ${p.position} → trinket ${finalized.trinketItemId}`);
  }

  console.log(`Updated ${updated} participant(s).`);
}

main().finally(() => prisma.$disconnect());
