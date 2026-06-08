/** Serializable player stats — safe for client components (no Prisma imports). */

export type TeamRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | "FILL";

export type MemberRole = "PLAYER" | "SUB" | "MANAGER" | "COACH" | "ANALYTICS";

export type PlayerRecord = {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type CombatSummary = {
  kills: number;
  deaths: number;
  assists: number;
  kdaLine: string;
  kdaRatio: number;
  kdaRatioLabel: string;
};

export type ChampionPoolEntry = PlayerRecord & {
  champion: string;
  combinedWinRate: number;
  combat: CombatSummary | null;
};

export type PlayerProfile = {
  id: string;
  displayName: string;
  summonerName: string | null;
  teamRole: TeamRole;
  memberRole: MemberRole;
  totalGames: number;
  overall: PlayerRecord;
  champions: ChampionPoolEntry[];
  recent: string[];
};
