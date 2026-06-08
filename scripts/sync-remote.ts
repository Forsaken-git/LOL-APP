/**
 * Push roster + all saved game exports to the live Railway hub.
 *
 *   npm run sync:remote
 *   npm run sync:remote -- --dry-run
 *   npm run sync:remote -- --skip-roster   # matches only
 */

import { readdirSync, statSync } from "fs";
import { extname, resolve } from "path";
import { parseGameDataJsonlFile } from "../src/lib/ingest/adapters/game-data-jsonl";
import {
  mergeIngestPayloads,
  normalizeIngestPayload,
} from "../src/lib/ingest/normalize";
import type { IngestPayload } from "../src/lib/ingest/types";
import {
  rosterEntryToIngestPlayer,
  teamRosterEntries,
} from "../src/lib/team-roster";
import { collectJsonFiles, loadIngestFromFiles, pushToHub, summarizePayload } from "./ingest-lib";
import { DEFAULT_HUB, resolveHubEnv } from "./load-hub-env";

const SKIP_JSON = new Set(["draft-latest.json"]);

function rosterPayload(): IngestPayload {
  const roster = teamRosterEntries();
  if (roster.length === 0) {
    throw new Error("data/team-roster.json has no players.");
  }
  return {
    source: "sync-remote-roster",
    players: roster.map((p) => rosterEntryToIngestPlayer(p)),
  };
}

function collectExportJson(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_JSON.has(name)) continue;
    if (!name.endsWith(".json")) continue;
    const full = resolve(dir, name);
    if (statSync(full).isFile()) out.push(full);
  }
  return out.sort();
}

function collectJsonl(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".jsonl"))
    .map((n) => resolve(dir, n))
    .sort();
}

async function loadExportsPayload(exportsDir: string): Promise<IngestPayload[]> {
  const payloads: IngestPayload[] = [];

  const jsonPaths = collectExportJson(exportsDir);
  if (jsonPaths.length > 0) {
    const refs = collectJsonFiles(jsonPaths);
    payloads.push(loadIngestFromFiles(refs));
    console.log(`  ${jsonPaths.length} LCU JSON → merged`);
  }

  const jsonlPaths = collectJsonl(exportsDir);
  for (const path of jsonlPaths) {
    try {
      const payload = await parseGameDataJsonlFile(path, {
        source: `jsonl-${path.split(/[/\\]/).pop()?.replace(".jsonl", "")}`,
      });
      payloads.push(payload);
      console.log(`  ${path.split(/[/\\]/).pop()} → 1 match`);
    } catch (e) {
      console.warn(
        `  Skipped ${path.split(/[/\\]/).pop()}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  return payloads;
}

async function main() {
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
  const dryRun = flags.has("--dry-run");
  const skipRoster = flags.has("--skip-roster");

  const { hubUrl, apiKey } = resolveHubEnv();
  const exportsDir = resolve("data/exports");

  console.log(`Target: ${hubUrl}`);
  console.log("Loading data...");

  const parts: IngestPayload[] = [];
  if (!skipRoster) {
    parts.push(rosterPayload());
    console.log(`  Roster: ${teamRosterEntries().length} players`);
  }

  const exportParts = await loadExportsPayload(exportsDir);
  parts.push(...exportParts);

  if (parts.length === 0) {
    throw new Error("Nothing to sync.");
  }

  const payload = mergeIngestPayloads(parts);
  console.log(`\nTotal: ${summarizePayload(payload)}`);

  if (dryRun) {
    console.log("\n--dry-run: no data sent");
    return;
  }

  console.log(`\nPushing to ${hubUrl} ...`);
  const result = await pushToHub(payload, hubUrl, apiKey);
  console.log(JSON.stringify(result, null, 2));
  console.log("\nDone — refresh the hub (Overview, Matches, Picks & Bans).");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "fetch failed") {
    console.error(`Could not reach the hub. Check HUB_URL (expected ${DEFAULT_HUB}).`);
  } else {
    console.error(msg);
  }
  process.exit(1);
});
