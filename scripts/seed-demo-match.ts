/**
 * Insert one artificial CWL game for UI preview.
 *
 *   npm run seed:demo
 *   npm run clean:demo
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { normalizeIngestPayload } from "../src/lib/ingest/normalize";
import { runIngest } from "../src/lib/ingest/sync";
import { prisma } from "../src/lib/prisma";

const DEMO_PATH = resolve("data/demo-match.json");
const DEMO_EXTERNAL_ID = "demo-cwl-glacier-five-2026-05-26";

async function seed() {
  const raw = JSON.parse(readFileSync(DEMO_PATH, "utf-8")) as unknown;
  const payload = normalizeIngestPayload(raw);
  const result = await runIngest(payload);

  if (!result.success) {
    console.error("Ingest failed:", result.errors);
    process.exit(1);
  }

  const match = await prisma.match.findUnique({
    where: { externalId: DEMO_EXTERNAL_ID },
    include: {
      participants: { include: { player: true } },
      pickBans: true,
    },
  });

  console.log("Demo match ready:");
  console.log(
    `  ${match?.league} vs ${match?.opponent} — ${match?.result} (${match?.side})`,
  );
  console.log(`  ${match?.participants.length} roster rows, ${match?.pickBans.length} pick/ban rows`);
  console.log("  Open Matches or Overview and click the game for the scoreboard.");
}

async function clean() {
  const row = await prisma.match.findUnique({
    where: { externalId: DEMO_EXTERNAL_ID },
  });
  if (!row) {
    console.log("No demo match found.");
    return;
  }
  await prisma.pickBan.deleteMany({ where: { matchId: row.id } });
  await prisma.matchParticipant.deleteMany({ where: { matchId: row.id } });
  await prisma.match.delete({ where: { id: row.id } });
  console.log("Removed demo match.");
}

const cleanFlag = process.argv.includes("--clean");

(cleanFlag ? clean() : seed())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
