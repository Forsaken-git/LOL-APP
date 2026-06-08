/**
 * Import a game_data_*.jsonl capture (LCU + Live Client poll log).
 *
 *   npm run ingest:jsonl -- game_data_20260525_214732.jsonl --local
 *   npm run ingest:jsonl -- Scrims/game_data_20260525_214732.jsonl --local
 */

import { resolve } from "path";
import { parseGameDataJsonlFile } from "../src/lib/ingest/adapters/game-data-jsonl";
import {
  applyFolderContext,
  inferFolderContext,
} from "../src/lib/ingest/folder-context";
import { ingestLocal, pushToHub, summarizePayload } from "./ingest-lib";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const fileArg = args.find((a) => !a.startsWith("--"));

if (!fileArg) {
  console.error(
    "Usage: npm run ingest:jsonl -- <path-to.jsonl> [--local] [--league Scrims]",
  );
  process.exit(1);
}

const local = flags.has("--local");
const leagueFlag = args.find((a) => a.startsWith("--league="));
const league = leagueFlag?.split("=")[1];

const abs = resolve(fileArg);
const folderContext = inferFolderContext(abs);

async function main() {
  let payload = await parseGameDataJsonlFile(abs, {
    league: league ?? folderContext?.league,
    source: folderContext
      ? `import-${folderContext.sourceLabel}-${abs.split(/[/\\]/).pop()?.replace(".jsonl", "")}`
      : undefined,
  });

  payload = applyFolderContext(payload, folderContext);

  console.log(`Loaded: ${summarizePayload(payload)}`);
  if (payload.matches?.[0]) {
    const m = payload.matches[0];
    console.log(
      `  ${m.league} vs ${m.opponent} · ${m.result} · ${m.side} · ${m.participants?.length ?? 0} players`,
    );
  }

  const result = local
    ? await ingestLocal(payload)
    : await pushToHub(
        payload,
        process.env.HUB_URL ?? "http://localhost:3000",
        process.env.INGEST_API_KEY ?? "",
      );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
