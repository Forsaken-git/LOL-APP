import type { PlayerRegion } from "@/lib/player-accounts-shared";

export type SoloQChampStat = {
  champion: string;
  games: number;
  wins: number;
  winRate: number;
  avgCsPerMin: number;
  avgDamagePerGold: number;
};

export type SoloQPatchStat = {
  patch: string;
  games: number;
  wins: number;
  winRate: number;
};

export type SoloQVolumeWindow = {
  days: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type SoloQAdvancedMetrics = {
  source: "soloq_riot";
  matchCount: number;
  lastSyncedAt: string | null;
  averages: {
    csPerMin: number | null;
    goldPerMin: number | null;
    damagePerMin: number | null;
    /** Damage per gold earned. */
    goldEfficiency: number | null;
    /** Average share of team damage (0–1). */
    damageShare: number | null;
  };
  volume: {
    windows: SoloQVolumeWindow[];
    /** Stddev of recent win(1)/loss(0) outcomes — higher = less consistent. */
    consistencyStdDev: number | null;
  };
  spam: {
    topChampion: string | null;
    shareLastN: number | null;
    window: number;
    longestStreak: number;
    longestStreakChampion: string | null;
  };
  fatigue: {
    champion: string | null;
    recentGames: number;
    recentWinRate: number | null;
    baselineWinRate: number | null;
    flag: boolean;
  } | null;
  patchAdaptability: SoloQPatchStat[];
  champions: SoloQChampStat[];
  mmrVelocity: {
    sampleCount: number;
    /** LP delta from oldest to newest snapshot in window (tier jumps approx +100). */
    lpDelta: number | null;
    /** Rough LP change per day. */
    lpPerDay: number | null;
    from: {
      tier: string;
      rank: string;
      lp: number;
      at: string;
    } | null;
    to: {
      tier: string;
      rank: string;
      lp: number;
      at: string;
    } | null;
  };
  accounts: Array<{
    accountId: string;
    region: PlayerRegion;
    summonerName: string;
    matchCount: number;
  }>;
};
