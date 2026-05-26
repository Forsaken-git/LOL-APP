/**
 * Inspect unknown JSON structure before import.
 *
 *   npm run ingest:inspect -- data/import/my-export.json
 *   npm run ingest:inspect -- data/import/my-export.json --try
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { inferFolderContext } from "../src/lib/ingest/folder-context";
import { inspectJsonStructure } from "../src/lib/ingest/inspect";
import { normalizeIngestPayload } from "../src/lib/ingest/normalize";
import { summarizePayload } from "./ingest-lib";

const args = process.argv.slice(2);
const tryImport = args.includes("--try");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("Usage: npm run ingest:inspect -- <file.json> [--try]");
  process.exit(1);
}

const abs = resolve(file);
const raw = JSON.parse(readFileSync(abs, "utf-8")) as unknown;
const folderContext = inferFolderContext(abs);

console.log(inspectJsonStructure(raw));
if (folderContext) {
  console.log(
    `\nFolder context: ${folderContext.kind} → league "${folderContext.league}", gameType ${folderContext.gameType}`,
  );
}
console.log("\nTarget format: data/example-export.json");
console.log("Import: npm run ingest:bulk -- data/import --local --dry-run");

if (tryImport) {
  console.log("\n--- Import preview ---");
  try {
    const payload = normalizeIngestPayload(raw, { folderContext });
    console.log(summarizePayload(payload));
    if (payload.source) console.log(`Source: ${payload.source}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
