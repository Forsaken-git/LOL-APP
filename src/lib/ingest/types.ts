import type {
  EventType,
  GameType,
  LoLRole,
  MatchResult,
  PickBanType,
  Side,
  UserRole,
} from "@prisma/client";

export type IngestPlayer = {
  externalId?: string;
  displayName: string;
  summonerName?: string;
  teamRole?: LoLRole;
  memberRole?: UserRole;
  active?: boolean;
};

/** Items, summoner spells, and rune IDs from LCU end-of-game block. */
export type ParticipantBuild = {
  /** Up to 6 core inventory items (no ADC boots, no trinket). */
  itemIds: number[];
  /** ADC boots or captured support quest item. */
  questItemId?: number;
  trinketItemId?: number;
  spell1Id?: number;
  spell2Id?: number;
  perks?: {
    primaryStyle?: number;
    subStyle?: number;
    /** PERK0 … PERK5 rune IDs */
    slots: number[];
  };
};

export type IngestParticipant = {
  playerExternalId?: string;
  displayName?: string;
  summonerName?: string;
  champion: string;
  /** BLUE (100) or RED (200) in-game side */
  side?: Side;
  /** Opposing team player — stored for scoreboard, not team roster */
  opponent?: boolean;
  /** In-game position from match data (opponents / imports) */
  teamRole?: LoLRole;
  /** Raw lane from game client: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY */
  position?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  cs?: number;
  damage?: number;
  goldEarned?: number;
  visionScore?: number;
  build?: ParticipantBuild;
};

export type IngestPickBan = {
  champion: string;
  type: PickBanType;
  side: Side;
  order?: number;
};

export type IngestMatch = {
  externalId?: string;
  playedAt: string;
  league: string;
  opponent?: string;
  result: MatchResult;
  side: Side;
  gameType?: GameType;
  /** Game length in seconds (LCU `gameLength`) */
  gameDurationSec?: number;
  notes?: string;
  source?: string;
  mvpExternalId?: string;
  mvpDisplayName?: string;
  participants?: IngestParticipant[];
  pickBans?: IngestPickBan[];
};

export type IngestEvent = {
  externalId?: string;
  title: string;
  type: EventType;
  startAt: string;
  endAt?: string;
  description?: string;
  location?: string;
};

export type IngestPayload = {
  source?: string;
  players?: IngestPlayer[];
  matches?: IngestMatch[];
  events?: IngestEvent[];
};

export type IngestResult = {
  success: boolean;
  source?: string;
  players: { created: number; updated: number };
  matches: { created: number; updated: number };
  events: { created: number; updated: number };
  errors: string[];
};
