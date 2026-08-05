/**
 * Pull active players from the hub into local tracking files.
 *
 *   npm run sync:lcu-roster
 *
 * Uses HUB_URL from .env (defaults to http://localhost:3000).
 */

import { syncPlayerToTrackingFiles } from "../src/lib/roster-sync";
import type { LcuRosterPayload } from "../src/lib/players/lcu-roster";
import { localHubUrl, loadDotEnv } from "./load-hub-env";

async function main() {
  loadDotEnv();
  const hubUrl = localHubUrl();
  const apiKey = process.env.INGEST_API_KEY?.trim() ?? "";

  const res = await fetch(`${hubUrl}/api/players/lcu-roster`, {
    headers: apiKey ? { "x-api-key": apiKey } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Hub returned ${res.status}` +
        (res.status === 401
          ? " — set INGEST_API_KEY to match the hub"
          : ""),
    );
  }

  const payload = (await res.json()) as LcuRosterPayload;
  if (!payload.teamSummoners?.length) {
    console.log("No active players with summoner names on the hub.");
    console.log("Add players on the website first (Players → Add player).");
    return;
  }

  let rosterUpdates = 0;
  let lcuUpdates = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const name of payload.teamSummoners) {
    const key = name.toLowerCase();
    const entry = payload.roster[key];
    if (!entry || seen.has(key)) continue;
    seen.add(key);

    const result = syncPlayerToTrackingFiles({
      displayName: entry.displayName,
      summonerName: name,
      teamRole: entry.teamRole as "TOP",
      memberRole: entry.memberRole as "PLAYER",
      externalId: entry.externalId,
    });

    if (result.teamRoster === "updated") rosterUpdates++;
    if (result.lcuConfig === "updated") lcuUpdates++;
    if (result.teamRoster === "skipped" && result.lcuConfig === "skipped") {
      skipped++;
    }
  }

  console.log(
    `Synced ${payload.teamSummoners.length} summoner(s) from ${hubUrl}\n` +
      `  team-roster.json: ${rosterUpdates} added\n` +
      `  lcu-spectate.config.json: ${lcuUpdates} added\n` +
      `  already present / skipped: ${skipped}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
