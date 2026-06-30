/**
 * Pull active players from the running local hub into tracking files.
 *
 *   npm run dev   # in another terminal
 *   npm run sync:lcu-roster
 */

import { syncPlayerToTrackingFiles } from "../src/lib/roster-sync";
import { localHubUrl, loadDotEnv } from "./load-hub-env";

type HubPlayer = {
  displayName: string;
  summonerName: string | null;
  teamRole: string;
  memberRole: string;
  externalId: string | null;
};

async function main() {
  loadDotEnv();
  const hubUrl = localHubUrl();

  const res = await fetch(`${hubUrl}/api/players`);
  if (!res.ok) {
    throw new Error(`Hub returned ${res.status}`);
  }

  const { players } = (await res.json()) as { players: HubPlayer[] };
  if (!players?.length) {
    console.log("No active players on the hub.");
    return;
  }

  let rosterUpdates = 0;
  let lcuUpdates = 0;
  let skipped = 0;

  for (const p of players) {
    if (!p.summonerName) {
      console.warn(`Skip ${p.displayName} — no summoner name`);
      skipped++;
      continue;
    }

    const result = syncPlayerToTrackingFiles({
      displayName: p.displayName,
      summonerName: p.summonerName,
      teamRole: p.teamRole as "TOP",
      memberRole: p.memberRole as "PLAYER",
      externalId: p.externalId ?? undefined,
    });

    if (result.teamRoster === "updated") rosterUpdates++;
    if (result.lcuConfig === "updated") lcuUpdates++;
    if (result.teamRoster === "skipped" && result.lcuConfig === "skipped") {
      skipped++;
    }
  }

  console.log(
    `Synced ${players.length} players from ${hubUrl}\n` +
      `  team-roster.json: ${rosterUpdates} added\n` +
      `  lcu-spectate.config.json: ${lcuUpdates} added\n` +
      `  already present / skipped: ${skipped}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
