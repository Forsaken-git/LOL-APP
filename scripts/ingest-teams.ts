/**
 * Import hub JSON from team data folders: cwl, scrims, titans league, officials.
 *
 *   npm run ingest:teams
 *   npm run ingest:teams -- --dry-run
 *   npm run ingest:teams -- data/import --local
 *
 * Default: data/import/
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { TEAM_DATA_FOLDERS } from "../src/lib/ingest/folder-context";
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
const pathArg = args.find((a) => !a.startsWith("--"));

const root = resolve(pathArg ?? "data/import");
const local = flags.has("--local");
const dryRun = flags.has("--dry-run");
const hubUrl = process.env.HUB_URL ?? "http://localhost:3000";
const apiKey = process.env.INGEST_API_KEY ?? "";

async function main() {
  if (!existsSync(root)) {
    console.error(`Folder not found: ${root}`);
    console.error("\nCreate:");
    for (const name of TEAM_DATA_FOLDERS) {
      console.error(`  ${resolve(root, name)}/`);
    }
    process.exit(1);
  }

  const refs = collectJsonFiles([root]);
  if (refs.length === 0) {
    console.error(`No JSON files under ${root}`);
    console.error("Expected subfolders:", TEAM_DATA_FOLDERS.join(", "));
    process.exit(1);
  }

  console.log(`Root: ${root}`);
  console.log(`Files: ${refs.length} (${summarizeByFolder(refs)})`);

  const unlabeled = refs.filter((r) => !r.folderContext).length;
  if (unlabeled > 0) {
    console.warn(
      `Warning: ${unlabeled} file(s) are not under cwl/titans league/scrims — league may default to file content only.`,
    );
  }

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
