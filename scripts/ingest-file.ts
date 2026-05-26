/**
 * Push a single JSON file to /api/ingest (or import locally).
 *
 *   npm run ingest -- data/example-export.json
 *   npm run ingest -- data/exports/lcu-123.json --local
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { normalizeIngestPayload } from "../src/lib/ingest/normalize";
import { ingestLocal, pushToHub, summarizePayload } from "./ingest-lib";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const fileArg = args.find((a) => !a.startsWith("--"));

if (!fileArg) {
  console.error("Usage: npm run ingest -- <path-to.json> [--local] [--dry-run]");
  process.exit(1);
}

const local = flags.has("--local");
const dryRun = flags.has("--dry-run");
const hubUrl = process.env.HUB_URL ?? "http://localhost:3000";
const apiKey = process.env.INGEST_API_KEY ?? "";

const payload = normalizeIngestPayload(
  JSON.parse(readFileSync(resolve(fileArg), "utf-8")) as unknown,
);

async function main() {
  console.log(`Loaded: ${summarizePayload(payload)}`);

  if (dryRun) {
    console.log("--dry-run: no data written");
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
