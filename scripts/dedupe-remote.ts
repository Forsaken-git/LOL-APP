/**
 * Merge duplicate roster players on the live hub (same summoner, different externalId).
 *
 *   npm run dedupe:remote
 */

import { resolveHubEnv } from "./load-hub-env";

async function main() {
  const { hubUrl, apiKey } = resolveHubEnv();

  const res = await fetch(`${hubUrl}/api/ingest/dedupe-players`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  console.log(JSON.stringify(JSON.parse(text), null, 2));
  console.log("Done — refresh the Players page.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
