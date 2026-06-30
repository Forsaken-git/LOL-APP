/**
 * Import saved LCU exports into the local database.
 *
 *   npm run pull:local
 *   npm run pull:local -- --dry-run
 */

import { existsSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import {
  collectJsonFiles,
  ingestLocal,
  loadIngestFromFiles,
  summarizePayload,
} from "./ingest-lib";

const SKIP_EXPORT_JSON = new Set(["draft-latest.json"]);
const EXPORTS_DIR = resolve("data/exports");

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!existsSync(EXPORTS_DIR)) {
    throw new Error(`No ${EXPORTS_DIR} folder. Capture games with lcu:watch first.`);
  }

  const jsonPaths = readdirSync(EXPORTS_DIR)
    .filter((name) => name.endsWith(".json") && !SKIP_EXPORT_JSON.has(name))
    .map((name) => resolve(EXPORTS_DIR, name))
    .filter((path) => statSync(path).isFile());

  if (jsonPaths.length === 0) {
    throw new Error(`No LCU export JSON in ${EXPORTS_DIR}.`);
  }

  console.log(`Importing ${jsonPaths.length} file(s) from ${EXPORTS_DIR} …`);
  const payload = loadIngestFromFiles(collectJsonFiles(jsonPaths));
  console.log(`Loaded: ${summarizePayload(payload)}`);

  if (dryRun) {
    console.log("--dry-run: no data written");
    return;
  }

  const result = await ingestLocal(payload);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
