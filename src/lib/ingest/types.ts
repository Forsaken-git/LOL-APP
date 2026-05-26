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

export type IngestParticipant = {
  playerExternalId?: string;
  displayName?: string;
  summonerName?: string;
  champion: string;
  /** BLUE (100) or RED (200) in-game side */
  side?: Side;
  kills?: number;
  deaths?: number;
  assists?: number;
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
