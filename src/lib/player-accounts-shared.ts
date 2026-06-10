export type PlayerRegion = "WEST" | "EAST";

export type PlayerAccountView = {
  id?: string;
  region: PlayerRegion;
  summonerName: string;
};

export const LOL_REGIONS: PlayerRegion[] = ["WEST", "EAST"];

export const REGION_META: Record<
  PlayerRegion,
  { label: string; server: string; platformId: string; opGgSlug: string }
> = {
  WEST: { label: "West", server: "EUW", platformId: "EUW1", opGgSlug: "euw" },
  EAST: {
    label: "East",
    server: "EUNE",
    platformId: "EUNE1",
    opGgSlug: "eune",
  },
};

export function formatRegionLabel(region: PlayerRegion): string {
  const meta = REGION_META[region];
  return `${meta.label} (${meta.server})`;
}

export function validateSummonerName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Riot ID is required";
  if (!trimmed.includes("#")) {
    return "Use game name and tag, e.g. Player#EUW";
  }
  return null;
}

/** op.gg profile URL for a Riot ID on EUW or EUNE. */
export function opGgProfileUrl(
  region: PlayerRegion,
  summonerName: string,
): string {
  const slug = REGION_META[region].opGgSlug;
  const path = summonerName.trim().replace(/#/g, "-");
  return `https://op.gg/lol/summoners/${slug}/${encodeURIComponent(path)}`;
}

export function groupAccountsByRegion(
  accounts: PlayerAccountView[],
): Record<PlayerRegion, PlayerAccountView[]> {
  const grouped: Record<PlayerRegion, PlayerAccountView[]> = {
    WEST: [],
    EAST: [],
  };
  for (const account of accounts) {
    grouped[account.region].push(account);
  }
  return grouped;
}

export function primarySummonerName(
  accounts: PlayerAccountView[],
  fallback: string | null,
): string | null {
  const west = accounts.find((a) => a.region === "WEST")?.summonerName;
  if (west) return west;
  const east = accounts.find((a) => a.region === "EAST")?.summonerName;
  if (east) return east;
  return fallback;
}

export function normalizeSummonerKey(name: string): string {
  return name.trim().toLowerCase();
}
