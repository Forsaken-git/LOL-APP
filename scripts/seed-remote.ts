/**
 * Push roster from local data/team-roster.json to the live hub via /api/ingest.
 * Use when the DB is empty on Railway (roster file is not in Git).
 *
 *   $env:HUB_URL="https://lol-app-production.up.railway.app"
 *   $env:INGEST_API_KEY="your-railway-key"
 *   npm run seed:remote
 */

import {
  rosterEntryToIngestPlayer,
  teamRosterEntries,
} from "../src/lib/team-roster";
import type { IngestPayload } from "../src/lib/ingest/types";
import { pushToHub } from "./ingest-lib";
import { DEFAULT_HUB, resolveHubEnv } from "./load-hub-env";

async function main() {
  const { hubUrl, apiKey } = resolveHubEnv();

  const roster = teamRosterEntries();
  if (roster.length === 0) {
    console.error("data/team-roster.json has no players.");
    process.exit(1);
  }

  const payload: IngestPayload = {
    source: "seed-remote",
    players: roster.map((p) => rosterEntryToIngestPlayer(p)),
  };

  console.log(`Pushing ${payload.players!.length} players to ${hubUrl} ...`);
  const result = await pushToHub(payload, hubUrl, apiKey);
  console.log(JSON.stringify(result, null, 2));
  console.log("Done — refresh the hub in your browser.");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "fetch failed") {
    console.error(
      "Could not reach the hub. Check HUB_URL in .env (must be https://...up.railway.app).",
    );
  } else {
    console.error(msg);
  }
  process.exit(1);
});
