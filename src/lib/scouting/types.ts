import type { PlayerRegion } from "@/lib/player-accounts-shared";
import type { SoloQRank } from "@/lib/riot/types";

export type ScoutingChampionStat = {
  champion: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  /** (K+A)/D style ratio; deaths treated as 1 when 0. */
  kda: number;
};

export type ScoutingPlayerResult = {
  riotId: string;
  region: PlayerRegion;
  status: "ok" | "error";
  error?: string;
  soloq: SoloQRank | null;
  /** Ranked Solo/Flex sample size used for recent aggregates. */
  recentGames: number;
  recentWins: number;
  recentLosses: number;
  recentWinRate: number;
  recentKills: number;
  recentDeaths: number;
  recentAssists: number;
  recentKda: number;
  champions: ScoutingChampionStat[];
};

export type ScoutingReport = {
  region: PlayerRegion;
  fetchedAt: string;
  hasApiKey: boolean;
  sampleSize: number;
  players: ScoutingPlayerResult[];
  warnings: string[];
};
