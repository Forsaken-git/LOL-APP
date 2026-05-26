import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { LoLRole, UserRole } from "@prisma/client";

export type TeamRosterEntry = {
  displayName: string;
  summonerName?: string;
  teamRole?: LoLRole;
  memberRole?: UserRole;
  externalId?: string;
};

export type TeamRoster = {
  players: TeamRosterEntry[];
};

const ROSTER_PATHS = [
  resolve("data/team-roster.json"),
  resolve("team-roster.json"),
];

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function riotBase(name: string): string {
  return norm(name.split("#")[0] ?? name);
}

/** gameName#tag — tag compared case-insensitively (Riot tags are case-insensitive). */
function summonerMatches(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  const [ga, ta] = a.split("#");
  const [gb, tb] = b.split("#");
  if (!ta || !tb) return riotBase(a) === riotBase(b);
  return norm(ga) === norm(gb) && norm(ta) === norm(tb);
}

let cached: TeamRoster | null = null;

export function loadTeamRoster(): TeamRoster {
  if (cached) return cached;

  const path = ROSTER_PATHS.find((p) => existsSync(p));
  if (!path) {
    cached = { players: [] };
    return cached;
  }

  cached = JSON.parse(readFileSync(path, "utf-8")) as TeamRoster;
  return cached;
}

export function teamRosterEntries(): TeamRosterEntry[] {
  return loadTeamRoster().players;
}

export function isTeamRosterMember(ref: {
  displayName?: string;
  summonerName?: string;
  playerExternalId?: string;
}): boolean {
  const roster = teamRosterEntries();
  if (roster.length === 0) return true;

  const ext = ref.playerExternalId ? norm(ref.playerExternalId) : "";
  const sum = ref.summonerName ? norm(ref.summonerName) : "";
  const sumBase = ref.summonerName ? riotBase(ref.summonerName) : "";
  const name = ref.displayName ? norm(ref.displayName) : "";
  const nameBase = ref.displayName ? riotBase(ref.displayName) : "";

  return roster.some((entry) => {
    if (entry.externalId && ext && norm(entry.externalId) === ext) return true;
    if (entry.summonerName && ref.summonerName) {
      if (summonerMatches(entry.summonerName, ref.summonerName)) return true;
    }
    if (entry.displayName) {
      const eName = norm(entry.displayName);
      const eBase = riotBase(entry.displayName);
      if (name && (eName === name || eBase === nameBase)) return true;
    }
    return false;
  });
}

export function rosterEntryFor(ref: {
  displayName?: string;
  summonerName?: string;
  playerExternalId?: string;
}): TeamRosterEntry | undefined {
  const roster = teamRosterEntries();
  return roster.find((entry) => {
    if (entry.externalId && ref.playerExternalId) {
      return norm(entry.externalId) === norm(ref.playerExternalId);
    }
    if (entry.summonerName && ref.summonerName) {
      return summonerMatches(entry.summonerName, ref.summonerName);
    }
    if (entry.displayName && ref.displayName) {
      return riotBase(entry.displayName) === riotBase(ref.displayName);
    }
    return false;
  });
}
