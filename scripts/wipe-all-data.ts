/**
 * Remove all players, matches, events, and related team data.
 *
 *   npx tsx scripts/wipe-all-data.ts --yes
 *
 * Uses Turso when TURSO_* env vars are set; otherwise local SQLite (DATABASE_URL).
 */

import { createPrismaClient } from "../src/lib/create-prisma-client";
import { describeDatabaseConfig } from "../src/lib/turso-config";

const prisma = createPrismaClient();
const confirmed = process.argv.includes("--yes");

async function main() {
  const config = describeDatabaseConfig();
  console.log(`Target: ${config.mode}`);

  if (!confirmed) {
    console.error("Pass --yes to confirm wiping all players, matches, and events.");
    process.exit(1);
  }

  const removed = await prisma.$transaction(async (tx) => {
    const pickBans = await tx.pickBan.deleteMany();
    const participants = await tx.matchParticipant.deleteMany();
    const draftSessions = await tx.draftSession.deleteMany();
    await tx.match.updateMany({ data: { mvpId: null } });
    const matches = await tx.match.deleteMany();
    const draftPrep = await tx.draftPrepScenario.deleteMany();
    const ingestRuns = await tx.ingestRun.deleteMany();
    const availability = await tx.availabilitySlot.deleteMany();
    const tierlists = await tx.tierlist.deleteMany();
    const accounts = await tx.playerAccount.deleteMany();
    const players = await tx.player.deleteMany();
    const users = await tx.user.deleteMany();
    const events = await tx.event.deleteMany();

    return {
      pickBans: pickBans.count,
      participants: participants.count,
      draftSessions: draftSessions.count,
      matches: matches.count,
      draftPrep: draftPrep.count,
      ingestRuns: ingestRuns.count,
      availability: availability.count,
      tierlists: tierlists.count,
      accounts: accounts.count,
      players: players.count,
      users: users.count,
      events: events.count,
    };
  });

  console.log("Removed:");
  for (const [key, count] of Object.entries(removed)) {
    if (count > 0) console.log(`  ${key}: ${count}`);
  }
  console.log("\nDatabase is empty. Add players and matches when ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
