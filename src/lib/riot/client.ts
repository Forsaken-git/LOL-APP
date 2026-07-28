import {
  REGION_META,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";

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

/** EUW + EUNE use the Europe regional cluster for Account-V1 and Match-V5. */
export function regionalRoutingHost(_region: PlayerRegion): string {
  return "europe.api.riotgames.com";
}

export function platformHost(region: PlayerRegion): string {
  return `${REGION_META[region].platformId.toLowerCase()}.api.riotgames.com`;
}

export async function riotFetch<T>(
  url: string,
  apiKey: string,
  opts?: { bypassCache?: boolean },
): Promise<
  { ok: true; data: T } | { ok: false; status: number; message: string }
> {
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
    return {
      ok: false,
      status: 429,
      message: "Riot API rate limit — try again shortly",
    };
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
