/**
 * Keep only players listed in data/team-roster.json.
 *
 *   npx tsx scripts/prune-players.ts
 */

import { prisma } from "../src/lib/prisma";
import { isTeamRosterMember, teamRosterEntries } from "../src/lib/team-roster";

async function main() {
  const roster = teamRosterEntries();
  if (roster.length === 0) {
    console.error("No players in data/team-roster.json");
    process.exit(1);
  }

  console.log(`Team roster (${roster.length}):`);
  for (const p of roster) {
    console.log(`  · ${p.displayName}${p.summonerName ? ` (${p.summonerName})` : ""}`);
  }

  const all = await prisma.player.findMany({
    select: { id: true, displayName: true, summonerName: true, externalId: true },
  });

  const keepIds = new Set<string>();
  for (const p of all) {
    if (
      isTeamRosterMember({
        displayName: p.displayName,
        summonerName: p.summonerName ?? undefined,
        playerExternalId: p.externalId ?? undefined,
      })
    ) {
      keepIds.add(p.id);
    }
  }

  const toRemove = all.filter((p) => !keepIds.has(p.id));
  if (toRemove.length === 0) {
    console.log("\nNo extra players to remove.");
    return;
  }

  for (const p of toRemove) {
    await prisma.match.updateMany({ where: { mvpId: p.id }, data: { mvpId: null } });
    await prisma.matchParticipant.deleteMany({ where: { playerId: p.id } });
    await prisma.availabilitySlot.deleteMany({ where: { playerId: p.id } });
    await prisma.player.delete({ where: { id: p.id } });
    console.log(`Removed: ${p.displayName}${p.summonerName ? ` (${p.summonerName})` : ""}`);
  }

  console.log(`\nRemoved ${toRemove.length} player(s). Kept ${keepIds.size}.`);

  for (const entry of roster) {
    const existing = await prisma.player.findFirst({
      where: entry.summonerName
        ? { summonerName: entry.summonerName }
        : { displayName: entry.displayName },
    });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          displayName: entry.displayName,
          summonerName: entry.summonerName ?? existing.summonerName,
          teamRole: entry.teamRole ?? existing.teamRole,
          memberRole: entry.memberRole ?? existing.memberRole,
          externalId: entry.externalId ?? existing.externalId,
          active: true,
        },
      });
      continue;
    }
    await prisma.player.create({
      data: {
        displayName: entry.displayName,
        summonerName: entry.summonerName ?? null,
        teamRole: entry.teamRole ?? "FILL",
        memberRole: entry.memberRole ?? "PLAYER",
        externalId: entry.externalId ?? null,
        active: true,
      },
    });
    console.log(`Created roster player: ${entry.displayName}`);
  }
}

main().finally(() => prisma.$disconnect());
