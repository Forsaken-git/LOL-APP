import {
  REGION_META,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";
import type { SoloQRank } from "@/lib/riot/types";

export function getRiotApiKey(): string | null {
  const key = process.env.RIOT_API_KEY?.trim();
  return key || null;
}

export function parseRiotId(
  summonerName: string,
): { gameName: string; tagLine: string } | null {
  const trimmed = summonerName.trim();
  const hash = trimmed.lastIndexOf("#");
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  const gameName = trimmed.slice(0, hash).trim();
  const tagLine = trimmed.slice(hash + 1).trim();
  if (!gameName || !tagLine) return null;
  return { gameName, tagLine };
}

function regionalRoutingHost(_region: PlayerRegion): string {
  // EUW + EUNE both use the Europe regional cluster for Account-V1.
  return "europe.api.riotgames.com";
}

function platformHost(region: PlayerRegion): string {
  return `${REGION_META[region].platformId.toLowerCase()}.api.riotgames.com`;
}

async function riotFetch<T>(
  url: string,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
    ...(opts?.bypassCache
      ? { cache: "no-store" as const }
      : { next: { revalidate: 300 } }),
  });

  if (res.status === 404) {
    return { ok: false, status: 404, message: "Account not found" };
  }
  if (res.status === 429) {
    return { ok: false, status: 429, message: "Riot API rate limit — try again shortly" };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: body.slice(0, 180) || `Riot API error ${res.status}`,
    };
  }

  return { ok: true, data: (await res.json()) as T };
}

type AccountDto = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

type LeagueEntryDto = {
  queueType: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  hotStreak?: boolean;
};

export async function fetchSoloQByRiotId(
  summonerName: string,
  region: PlayerRegion,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<
  | { status: "ok"; soloq: SoloQRank }
  | { status: "unranked" }
  | { status: "error"; message: string }
> {
  const parsed = parseRiotId(summonerName);
  if (!parsed) {
    return { status: "error", message: "Invalid Riot ID (use Name#TAG)" };
  }

  const accountUrl =
    `https://${regionalRoutingHost(region)}/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`;

  const account = await riotFetch<AccountDto>(accountUrl, apiKey, opts);
  if (!account.ok) {
    return { status: "error", message: account.message };
  }

  const leagueUrl =
    `https://${platformHost(region)}/lol/league/v4/entries/by-puuid/` +
    `${encodeURIComponent(account.data.puuid)}`;

  const league = await riotFetch<LeagueEntryDto[]>(leagueUrl, apiKey, opts);
  if (!league.ok) {
    if (league.status === 404) return { status: "unranked" };
    return { status: "error", message: league.message };
  }

  const solo = league.data.find((e) => e.queueType === "RANKED_SOLO_5x5");
  if (!solo?.tier || !solo.rank) {
    return { status: "unranked" };
  }

  return {
    status: "ok",
    soloq: {
      tier: solo.tier,
      rank: solo.rank,
      leaguePoints: solo.leaguePoints ?? 0,
      wins: solo.wins ?? 0,
      losses: solo.losses ?? 0,
      hotStreak: Boolean(solo.hotStreak),
    },
  };
}
