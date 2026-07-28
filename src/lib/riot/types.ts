export type SoloQRank = {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
};

export type SoloQAccountResult = {
  playerId: string;
  displayName: string;
  teamRole: string;
  memberRole: string;
  accountId: string;
  region: "WEST" | "EAST";
  summonerName: string;
  status: "ok" | "unranked" | "error" | "missing_key";
  soloq: SoloQRank | null;
  error?: string;
};

export type SoloQStatsPayload = {
  fetchedAt: string;
  hasApiKey: boolean;
  results: SoloQAccountResult[];
};
