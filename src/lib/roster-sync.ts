import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  clearTeamRosterCache,
  rosterExternalId,
  type TeamRosterEntry,
} from "@/lib/team-roster";

const TEAM_ROSTER_PATH = resolve("data/team-roster.json");
const LCU_CONFIG_PATH = resolve("data/lcu-spectate.config.json");

export type TrackingFileStatus = "updated" | "skipped" | "missing";

export type TrackingSyncResult = {
  teamRoster: TrackingFileStatus;
  lcuConfig: TrackingFileStatus;
};

function summonerKey(name: string): string {
  return name.trim().toLowerCase();
}

function rosterEntryMatches(a: TeamRosterEntry, b: TeamRosterEntry): boolean {
  if (a.externalId && b.externalId) {
    return summonerKey(a.externalId) === summonerKey(b.externalId);
  }
  if (a.summonerName && b.summonerName) {
    return summonerKey(a.summonerName) === summonerKey(b.summonerName);
  }
  return summonerKey(a.displayName) === summonerKey(b.displayName);
}

/** Append player to local team-roster.json and lcu-spectate.config.json when those files exist. */
export function syncPlayerToTrackingFiles(
  entry: TeamRosterEntry,
): TrackingSyncResult {
  const result: TrackingSyncResult = {
    teamRoster: "missing",
    lcuConfig: "missing",
  };

  const normalized: TeamRosterEntry = {
    ...entry,
    externalId: entry.externalId ?? rosterExternalId(entry),
  };

  if (existsSync(TEAM_ROSTER_PATH)) {
    const raw = JSON.parse(readFileSync(TEAM_ROSTER_PATH, "utf-8")) as {
      players?: TeamRosterEntry[];
    };
    const players = raw.players ?? [];
    if (players.some((p) => rosterEntryMatches(p, normalized))) {
      result.teamRoster = "skipped";
    } else {
      players.push(normalized);
      writeFileSync(
        TEAM_ROSTER_PATH,
        `${JSON.stringify({ players }, null, 2)}\n`,
        "utf-8",
      );
      result.teamRoster = "updated";
    }
    clearTeamRosterCache();
  }

  if (existsSync(LCU_CONFIG_PATH) && normalized.summonerName) {
    const raw = JSON.parse(readFileSync(LCU_CONFIG_PATH, "utf-8")) as {
      teamSummoners?: string[];
      roster?: Record<string, Record<string, unknown>>;
    };
    const summoners = [...(raw.teamSummoners ?? [])];
    const roster = { ...(raw.roster ?? {}) };
    const key = summonerKey(normalized.summonerName);
    const sumKey = (s: string) => summonerKey(s);

    let changed = false;

    if (!summoners.some((s) => sumKey(s) === key)) {
      summoners.push(normalized.summonerName);
      changed = true;
    }

    const existing = roster[key];
    if (!existing) {
      roster[key] = {
        externalId: normalized.externalId,
        displayName: normalized.displayName,
        summonerName: normalized.summonerName,
        teamRole: normalized.teamRole ?? "FILL",
        memberRole: normalized.memberRole ?? "PLAYER",
      };
      changed = true;
    }

    if (changed) {
      raw.teamSummoners = summoners;
      raw.roster = roster;
      writeFileSync(
        LCU_CONFIG_PATH,
        `${JSON.stringify(raw, null, 2)}\n`,
        "utf-8",
      );
      result.lcuConfig = "updated";
    } else {
      result.lcuConfig = "skipped";
    }
  }

  return result;
}

function entryMatchesRef(
  entry: TeamRosterEntry,
  ref: {
    displayName: string;
    externalId?: string | null;
    summonerNames: string[];
  },
): boolean {
  const probe: TeamRosterEntry = {
    displayName: ref.displayName,
    externalId: ref.externalId ?? undefined,
    summonerName: ref.summonerNames[0],
  };
  if (rosterEntryMatches(entry, probe)) return true;
  return ref.summonerNames.some(
    (name) =>
      entry.summonerName &&
      summonerKey(entry.summonerName) === summonerKey(name),
  );
}

/** Remove a departed player from local tracking files (keeps DB match history). */
export function removePlayerFromTrackingFiles(ref: {
  displayName: string;
  externalId?: string | null;
  summonerNames: string[];
}): TrackingSyncResult {
  const result: TrackingSyncResult = {
    teamRoster: "missing",
    lcuConfig: "missing",
  };

  const summonerKeys = new Set(
    ref.summonerNames.map((name) => summonerKey(name)),
  );

  if (existsSync(TEAM_ROSTER_PATH)) {
    const raw = JSON.parse(readFileSync(TEAM_ROSTER_PATH, "utf-8")) as {
      players?: TeamRosterEntry[];
    };
    const before = raw.players ?? [];
    const players = before.filter((p) => !entryMatchesRef(p, ref));
    if (players.length !== before.length) {
      writeFileSync(
        TEAM_ROSTER_PATH,
        `${JSON.stringify({ players }, null, 2)}\n`,
        "utf-8",
      );
      result.teamRoster = "updated";
    } else {
      result.teamRoster = "skipped";
    }
    clearTeamRosterCache();
  }

  if (existsSync(LCU_CONFIG_PATH)) {
    const raw = JSON.parse(readFileSync(LCU_CONFIG_PATH, "utf-8")) as {
      teamSummoners?: string[];
      roster?: Record<string, Record<string, unknown>>;
    };
    const summoners = (raw.teamSummoners ?? []).filter(
      (s) => !summonerKeys.has(summonerKey(s)),
    );
    const roster = { ...(raw.roster ?? {}) };
    let rosterChanged = false;
    for (const key of Object.keys(roster)) {
      if (summonerKeys.has(key)) {
        delete roster[key];
        rosterChanged = true;
      }
    }

    const summonersChanged = summoners.length !== (raw.teamSummoners ?? []).length;
    if (summonersChanged || rosterChanged) {
      raw.teamSummoners = summoners;
      raw.roster = roster;
      writeFileSync(
        LCU_CONFIG_PATH,
        `${JSON.stringify(raw, null, 2)}\n`,
        "utf-8",
      );
      result.lcuConfig = "updated";
    } else {
      result.lcuConfig = "skipped";
    }
  }

  return result;
}
