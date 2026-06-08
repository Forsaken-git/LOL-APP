import type { LoLRole, Prisma } from "@prisma/client";
import {
  laneIndexFromPosition,
  normalizeParticipantBuild,
  scoreboardRoleForLaneIndex,
} from "@/lib/build-normalize";
import { championDisplayName } from "@/lib/champions";
import { validateIngestMatch } from "@/lib/ingest/collector-validate";
import { ensureOurTeamPickBans } from "@/lib/matches/sync-our-pick-bans";
import { dedupeActivePlayers } from "@/lib/player-dedupe";
import { prisma } from "@/lib/prisma";
import { isTeamRosterMember, rosterEntryFor } from "@/lib/team-roster";
import type {
  IngestMatch,
  IngestParticipant,
  IngestPayload,
  IngestPlayer,
  IngestResult,
} from "./types";

const DEFAULT_ROLE: LoLRole = "FILL";

export async function runIngest(payload: IngestPayload): Promise<IngestResult> {
  const result: IngestResult = {
    success: true,
    source: payload.source,
    players: { created: 0, updated: 0 },
    matches: { created: 0, updated: 0 },
    events: { created: 0, updated: 0 },
    errors: [],
  };

  const playerCache = new Map<string, string>();

  for (const player of payload.players ?? []) {
    if (!isTeamRosterMember(player)) continue;
    try {
      const { id, created } = await upsertPlayer(player);
      cachePlayer(playerCache, player, id);
      if (created) result.players.created++;
      else result.players.updated++;
    } catch (e) {
      result.errors.push(`player ${player.displayName}: ${formatError(e)}`);
    }
  }

  for (const match of payload.matches ?? []) {
    try {
      const { created } = await upsertMatch(match, playerCache);
      if (created) result.matches.created++;
      else result.matches.updated++;
    } catch (e) {
      result.errors.push(
        `match ${match.externalId ?? match.opponent}: ${formatError(e)}`,
      );
    }
  }

  for (const event of payload.events ?? []) {
    try {
      const created = await upsertEvent(event);
      if (created) result.events.created++;
      else result.events.updated++;
    } catch (e) {
      result.errors.push(`event ${event.title}: ${formatError(e)}`);
    }
  }

  if (result.errors.length > 0) result.success = false;

  try {
    await dedupeActivePlayers();
  } catch (e) {
    result.errors.push(`dedupe: ${formatError(e)}`);
    result.success = false;
  }

  await prisma.ingestRun.create({
    data: {
      source: payload.source ?? "api",
      success: result.success,
      summary: JSON.stringify({
        players: result.players,
        matches: result.matches,
        events: result.events,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 20),
      }),
    },
  });

  return result;
}

async function findExistingPlayerByIdentity(player: IngestPlayer) {
  const candidates = await prisma.player.findMany({
    where: {
      OR: [
        ...(player.summonerName ? [{ summonerName: player.summonerName }] : []),
        ...(player.displayName ? [{ displayName: player.displayName }] : []),
      ],
    },
  });

  return (
    candidates.find((row) => {
      if (
        player.summonerName &&
        row.summonerName &&
        summonerNamesMatch(row.summonerName, player.summonerName)
      ) {
        return true;
      }
      if (
        player.displayName &&
        row.displayName.trim().toLowerCase() ===
          player.displayName.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    }) ?? null
  );
}

async function findExistingPlayer(player: IngestPlayer) {
  if (player.externalId) {
    const byExt = await prisma.player.findUnique({
      where: { externalId: player.externalId },
    });
    if (byExt) return byExt;
  }
  return findExistingPlayerByIdentity(player);
}

function summonerNamesMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return true;
  const [ga, ta] = a.split("#");
  const [gb, tb] = b.split("#");
  if (!ta || !tb) return ga.trim().toLowerCase() === gb.trim().toLowerCase();
  return (
    ga.trim().toLowerCase() === gb.trim().toLowerCase() &&
    ta.trim().toLowerCase() === tb.trim().toLowerCase()
  );
}

async function upsertPlayer(
  player: IngestPlayer,
): Promise<{ id: string; created: boolean }> {
  const data: Prisma.PlayerCreateInput = {
    displayName: player.displayName,
    summonerName: player.summonerName ?? null,
    teamRole: player.teamRole ?? DEFAULT_ROLE,
    memberRole: player.memberRole ?? "PLAYER",
    active: player.active ?? true,
    externalId: player.externalId ?? null,
  };

  if (player.externalId) {
    const byExt = await prisma.player.findUnique({
      where: { externalId: player.externalId },
    });
    if (byExt) {
      const row = await prisma.player.update({
        where: { id: byExt.id },
        data: {
          displayName: data.displayName,
          summonerName: data.summonerName,
          teamRole: data.teamRole,
          memberRole: data.memberRole,
          active: data.active,
        },
      });
      return { id: row.id, created: false };
    }

    const byIdentity = await findExistingPlayerByIdentity(player);
    if (byIdentity) {
      const row = await prisma.player.update({
        where: { id: byIdentity.id },
        data: {
          displayName: data.displayName,
          summonerName: data.summonerName ?? byIdentity.summonerName,
          teamRole: data.teamRole,
          memberRole: data.memberRole,
          active: data.active,
          externalId: player.externalId,
        },
      });
      return { id: row.id, created: false };
    }

    const row = await prisma.player.create({ data });
    return { id: row.id, created: true };
  }

  const existing = await findExistingPlayer(player);
  if (existing) {
    const row = await prisma.player.update({
      where: { id: existing.id },
      data: {
        displayName: data.displayName,
        summonerName: data.summonerName ?? existing.summonerName,
        teamRole: player.teamRole ?? existing.teamRole,
        memberRole: player.memberRole ?? existing.memberRole,
        active: player.active ?? existing.active,
        externalId: player.externalId ?? existing.externalId,
      },
    });
    return { id: row.id, created: false };
  }

  const row = await prisma.player.create({ data });
  return { id: row.id, created: true };
}

function cachePlayer(
  cache: Map<string, string>,
  player: IngestPlayer,
  id: string,
) {
  if (player.externalId) cache.set(`ext:${player.externalId}`, id);
  cache.set(`name:${player.displayName.toLowerCase()}`, id);
  if (player.summonerName) {
    cache.set(`sum:${player.summonerName.toLowerCase()}`, id);
  }
}

async function resolvePlayerId(
  cache: Map<string, string>,
  ref: IngestParticipant,
): Promise<string> {
  if (ref.playerExternalId) {
    const cached = cache.get(`ext:${ref.playerExternalId}`);
    if (cached) return cached;
    const found = await prisma.player.findUnique({
      where: { externalId: ref.playerExternalId },
    });
    if (found) return found.id;
  }
  if (ref.summonerName) {
    const key = `sum:${ref.summonerName.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const found = await prisma.player.findFirst({
      where: { summonerName: ref.summonerName },
    });
    if (found) return found.id;
  }
  if (ref.displayName) {
    const key = `name:${ref.displayName.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const found = await prisma.player.findFirst({
      where: { displayName: ref.displayName },
    });
    if (found) return found.id;

    if (!isTeamRosterMember(ref)) {
      throw new Error(`not_on_roster:${ref.displayName ?? ref.summonerName ?? "unknown"}`);
    }

    const roster = rosterEntryFor(ref);
    const created = await prisma.player.create({
      data: {
        displayName: ref.displayName,
        summonerName: ref.summonerName ?? roster?.summonerName ?? null,
        teamRole: roster?.teamRole ?? DEFAULT_ROLE,
        memberRole: roster?.memberRole ?? "PLAYER",
        externalId: ref.playerExternalId ?? roster?.externalId ?? null,
      },
    });
    cache.set(key, created.id);
    return created.id;
  }
  throw new Error("participant needs playerExternalId, displayName, or summonerName");
}

async function resolveOpponentPlayerId(
  match: IngestMatch,
  part: IngestParticipant,
  cache: Map<string, string>,
): Promise<string> {
  const team = (match.opponent ?? "opponent").trim();
  const label =
    part.displayName ??
    part.summonerName?.split("#")[0] ??
    part.champion;
  const externalId =
    part.playerExternalId ??
    `opponent:${match.externalId ?? team}:${label.toLowerCase().replace(/\s+/g, "-")}`;

  const cacheKey = `ext:${externalId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const existing = await prisma.player.findUnique({ where: { externalId } });
  const row = existing
    ? await prisma.player.update({
        where: { id: existing.id },
        data: {
          displayName: label,
          summonerName: part.summonerName ?? existing.summonerName,
          teamRole: part.teamRole ?? existing.teamRole,
          active: false,
        },
      })
    : await prisma.player.create({
        data: {
          externalId,
          displayName: label,
          summonerName: part.summonerName ?? null,
          teamRole: part.teamRole ?? "FILL",
          memberRole: "PLAYER",
          active: false,
        },
      });

  cache.set(cacheKey, row.id);
  cache.set(`name:${label.toLowerCase()}`, row.id);
  return row.id;
}

async function resolveMvpId(
  match: IngestMatch,
  cache: Map<string, string>,
): Promise<string | null> {
  if (match.mvpExternalId) {
    const cached = cache.get(`ext:${match.mvpExternalId}`);
    if (cached) return cached;
    const p = await prisma.player.findUnique({
      where: { externalId: match.mvpExternalId },
    });
    if (p) return p.id;
  }
  if (match.mvpDisplayName) {
    const key = `name:${match.mvpDisplayName.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const p = await prisma.player.findFirst({
      where: { displayName: match.mvpDisplayName },
    });
    if (p) return p.id;
  }
  return null;
}

async function upsertMatch(
  match: IngestMatch,
  cache: Map<string, string>,
): Promise<{ created: boolean; id: string }> {
  const mvpId = await resolveMvpId(match, cache);

  const matchData = {
    playedAt: new Date(match.playedAt),
    league: match.league,
    opponent: match.opponent ?? null,
    status: "PLAYED" as const,
    result: match.result,
    side: match.side,
    gameType: match.gameType ?? "OFFICIAL",
    gameDurationSec: match.gameDurationSec ?? null,
    notes: match.notes ?? null,
    source: match.source ?? null,
    mvpId,
    externalId: match.externalId ?? null,
  };

  let row;
  let created = false;

  if (match.externalId) {
    const existing = await prisma.match.findUnique({
      where: { externalId: match.externalId },
    });
    if (existing) {
      row = await prisma.match.update({
        where: { id: existing.id },
        data: matchData,
      });
    } else {
      row = await prisma.match.create({ data: matchData });
      created = true;
    }
  } else {
    row = await prisma.match.create({ data: matchData });
    created = true;
  }

  await prisma.pickBan.deleteMany({ where: { matchId: row.id } });
  await prisma.matchParticipant.deleteMany({ where: { matchId: row.id } });

  for (const [index, pb] of (match.pickBans ?? []).entries()) {
    await prisma.pickBan.create({
      data: {
        matchId: row.id,
        champion: pb.champion,
        type: pb.type,
        side: pb.side,
        order: pb.order ?? index,
      },
    });
  }

  for (const part of match.participants ?? []) {
    const isOpponent = part.opponent === true;
    if (!isOpponent && !isTeamRosterMember(part)) continue;

    let playerId: string;
    try {
      playerId = isOpponent
        ? await resolveOpponentPlayerId(match, part, cache)
        : await resolvePlayerId(cache, part);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("not_on_roster:")) continue;
      throw e;
    }

    const laneIndex = laneIndexFromPosition(part.position);
    await prisma.matchParticipant.create({
      data: {
        matchId: row.id,
        playerId,
        champion: championDisplayName(part.champion),
        side: part.side ?? null,
        position: part.position ?? null,
        kills: part.kills ?? null,
        deaths: part.deaths ?? null,
        assists: part.assists ?? null,
        cs: part.cs ?? null,
        damage: part.damage ?? null,
        goldEarned: part.goldEarned ?? null,
        visionScore: part.visionScore ?? null,
        buildJson: part.build
          ? JSON.stringify(
              normalizeParticipantBuild(part.build, {
                position: part.position,
                teamRole: part.teamRole,
                laneIndex,
                scoreboardRole: scoreboardRoleForLaneIndex(laneIndex),
              }) ?? part.build,
            )
          : null,
      },
    });
  }

  const validation = validateIngestMatch(match);
  if (!validation.ok) {
    console.warn(
      `[ingest] incomplete collector data for ${match.externalId ?? row.id}:`,
      validation.warnings.join("; "),
    );
  }

  await ensureOurTeamPickBans(row.id);

  return { created, id: row.id };
}

async function upsertEvent(
  event: import("./types").IngestEvent,
): Promise<boolean> {
  const data = {
    title: event.title,
    type: event.type,
    startAt: new Date(event.startAt),
    endAt: event.endAt ? new Date(event.endAt) : null,
    description: event.description ?? null,
    location: event.location ?? null,
    externalId: event.externalId ?? null,
  };

  if (event.externalId) {
    const existing = await prisma.event.findUnique({
      where: { externalId: event.externalId },
    });
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data });
      return false;
    }
    await prisma.event.create({ data });
    return true;
  }

  await prisma.event.create({ data });
  return true;
}

function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
