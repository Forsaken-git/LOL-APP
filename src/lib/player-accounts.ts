import type { LoLRegion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatRegionLabel,
  normalizeSummonerKey,
  type PlayerAccountView,
  validateSummonerName,
} from "@/lib/player-accounts-shared";

export type { PlayerAccountView, PlayerRegion } from "@/lib/player-accounts-shared";
export {
  formatRegionLabel,
  groupAccountsByRegion,
  LOL_REGIONS,
  normalizeSummonerKey,
  opGgProfileUrl,
  primarySummonerName,
  REGION_META,
  validateSummonerName,
} from "@/lib/player-accounts-shared";

/** Backfill WEST account from legacy Player.summonerName when missing. */
export async function ensurePlayerAccounts(
  playerId: string,
): Promise<PlayerAccountView[]> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] } },
  });
  if (!player) return [];

  if (player.accounts.length === 0 && player.summonerName) {
    const row = await prisma.playerAccount.create({
      data: {
        playerId,
        region: "WEST",
        summonerName: player.summonerName,
      },
    });
    return [
      {
        id: row.id,
        region: "WEST",
        summonerName: row.summonerName,
      },
    ];
  }

  return player.accounts.map((a) => ({
    id: a.id,
    region: a.region,
    summonerName: a.summonerName,
  }));
}

export function parseAccountsBody(
  body: unknown,
): { ok: true; accounts: PlayerAccountView[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  if (!Array.isArray(raw.accounts)) {
    return { ok: false, error: "accounts array is required" };
  }

  const seenSummoners = new Set<string>();
  const accounts: PlayerAccountView[] = [];

  for (const item of raw.accounts) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid account entry" };
    }
    const row = item as Record<string, unknown>;
    const region = row.region;
    const summonerName =
      typeof row.summonerName === "string" ? row.summonerName.trim() : "";

    if (region !== "WEST" && region !== "EAST") {
      return { ok: false, error: "Region must be WEST or EAST" };
    }

    if (!summonerName) continue;

    const validation = validateSummonerName(summonerName);
    if (validation) {
      return { ok: false, error: `${formatRegionLabel(region)}: ${validation}` };
    }

    const key = normalizeSummonerKey(summonerName);
    if (seenSummoners.has(key)) {
      return { ok: false, error: `${summonerName} is listed more than once` };
    }
    seenSummoners.add(key);

    accounts.push({ region, summonerName });
  }

  return { ok: true, accounts };
}
