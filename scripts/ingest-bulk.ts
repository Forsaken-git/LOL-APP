/**
 * Import one or more saved JSON exports (folder or files).
 *
 *   npm run ingest:bulk -- data/exports
 *   npm run ingest:bulk -- data/exports --local
 *   npm run ingest:bulk -- data/exports file.json --dry-run
 *
 * LCU spectate saves per-game files to data/exports/ by default.
 * Use --local to write directly to the database (no dev server required).
 */

import {
  collectJsonFiles,
  ingestLocal,
  loadIngestFromFiles,
  pushToHub,
  summarizeByFolder,
  summarizePayload,
} from "./ingest-lib";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const paths = args.filter((a) => !a.startsWith("--"));

if (paths.length === 0) {
  console.error(`Usage: npm run ingest:bulk -- <folder-or.json> [...] [--local] [--dry-run]

Examples:
  npm run ingest:bulk -- data/exports --local
  npm run ingest:bulk -- data/exports/lcu-123.json`);
  process.exit(1);
}

const local = flags.has("--local");
const dryRun = flags.has("--dry-run");
const hubUrl = process.env.HUB_URL ?? "http://localhost:3000";
const apiKey = process.env.INGEST_API_KEY ?? "";

async function main() {
  const refs = collectJsonFiles(paths);
  console.log(`Found ${refs.length} JSON file(s)`);
  const byFolder = summarizeByFolder(refs);
  if (byFolder) console.log(`Folders: ${byFolder}`);

  const payload = loadIngestFromFiles(refs);
  console.log(`Merged: ${summarizePayload(payload)}`);
  if (payload.source) console.log(`Source: ${payload.source}`);

  if (dryRun) {
    console.log("\n--dry-run: no data written");
    return;
  }

  const result = local
    ? await ingestLocal(payload)
    : await pushToHub(payload, hubUrl, apiKey);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
