import type { PlayerRegion } from "@/lib/player-accounts-shared";
import {
  fetchSoloQEntryByPuuid,
  resolvePuuidByRiotId,
} from "@/lib/riot/match-v5";
import { getRiotApiKey } from "@/lib/riot/client";
import type { SoloQRank } from "@/lib/riot/types";

export { getRiotApiKey } from "@/lib/riot/client";
export { parseRiotId } from "@/lib/riot/client";

export async function fetchSoloQByRiotId(
  summonerName: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<
  | { status: "ok"; soloq: SoloQRank; puuid: string }
  | { status: "unranked"; puuid: string }
  | { status: "error"; message: string }
> {
  const resolved = await resolvePuuidByRiotId(
    summonerName,
    region,
    apiKey,
    opts,
  );
  if (resolved.status === "error") {
    return resolved;
  }

  const entry = await fetchSoloQEntryByPuuid(
    resolved.puuid,
    region,
    apiKey,
    opts,
  );
  if (entry.status === "error") {
    return entry;
  }
  if (entry.status === "unranked") {
    return { status: "unranked", puuid: resolved.puuid };
  }
  return { status: "ok", soloq: entry.soloq, puuid: resolved.puuid };
}

/** Convenience when callers only have env key lookup. */
export function requireRiotApiKey(): string | null {
  return getRiotApiKey();
}
