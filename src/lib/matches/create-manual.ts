import type { Side } from "@prisma/client";
import {
  finalizeParticipantBuild,
  laneIndexFromPosition,
  scoreboardRoleForLaneIndex,
} from "@/lib/build-normalize";
import { prisma } from "@/lib/prisma";
import { ensureOurTeamPickBans } from "@/lib/matches/sync-our-pick-bans";
import type { ParticipantBuild } from "@/lib/ingest/types";
import type { ParsedManualMatchBody, ParsedParticipantRow } from "./parse-body";

type BuildLike = {
  itemIds?: unknown;
  spell1Id?: unknown;
  spell2Id?: unknown;
  perks?: ParticipantBuild["perks"];
};

function parseBuildJson(raw: string | null | undefined): BuildLike | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BuildLike;
  } catch {
    return null;
  }
}

function slotKey(side: Side, position: string | null | undefined): string {
  return `${side}:${position ?? ""}`;
}

async function ensureOpponentPlayer(
  opponentTeam: string,
  row: ParsedParticipantRow,
  matchKey: string,
): Promise<string> {
  const label = row.label ?? row.champion;
  const externalId = `opponent:${matchKey}:${label.toLowerCase().replace(/\s+/g, "-")}`;

  const existing = await prisma.player.findUnique({ where: { externalId } });
  const data = {
    displayName: label,
    summonerName: row.label ?? null,
    teamRole: "FILL" as const,
    memberRole: "PLAYER" as const,
    active: false,
  };

  const player = existing
    ? await prisma.player.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.player.create({
        data: { ...data, externalId },
      });

  return player.id;
}

function participantData(
  matchId: string,
  playerId: string,
  row: ParsedParticipantRow,
  side: Side,
  preservedPerks?: ParticipantBuild["perks"],
) {
  const laneIndex = laneIndexFromPosition(row.position);
  const buildCtx = {
    position: row.position,
    laneIndex,
    scoreboardRole: scoreboardRoleForLaneIndex(laneIndex),
  };
  const build = row.build
    ? finalizeParticipantBuild(
        {
          ...row.build,
          perks: row.build.perks ?? preservedPerks,
        },
        buildCtx,
      )
    : preservedPerks
      ? finalizeParticipantBuild({ itemIds: [], perks: preservedPerks }, buildCtx)
      : undefined;

  return {
    matchId,
    playerId,
    champion: row.champion,
    side,
    position: row.position,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    cs: row.cs,
    damage: row.damage,
    goldEarned: row.goldEarned,
    visionScore: row.visionScore,
    buildJson: build ? JSON.stringify(build) : null,
  };
}

export async function createManualMatch(
  input: ParsedManualMatchBody,
): Promise<{ id: string }> {
  return saveManualMatch(input);
}

export async function updateManualMatch(
  matchId: string,
  input: ParsedManualMatchBody,
): Promise<{ id: string }> {
  return saveManualMatch(input, matchId);
}

async function saveManualMatch(
  input: ParsedManualMatchBody,
  matchId?: string,
): Promise<{ id: string }> {
  const enemySide: Side = input.side === "BLUE" ? "RED" : "BLUE";
  const matchKey = matchId ?? `${input.opponent}-${input.playedAt.getTime()}`;
  const preservedPerksBySlot = new Map<string, ParticipantBuild["perks"]>();

  const ourPlayerIds = input.ourParticipants.map((p) => p.playerId!);
  const roster = await prisma.player.findMany({
    where: { id: { in: ourPlayerIds }, active: true },
  });
  if (roster.length !== ourPlayerIds.length) {
    throw new Error("One or more selected players are invalid");
  }

  const match = matchId
    ? await prisma.match.update({
        where: { id: matchId },
        data: {
          playedAt: input.playedAt,
          gameDurationSec: input.gameDurationSec,
          league: input.league,
          opponent: input.opponent,
          status: "PLAYED",
          result: input.result,
          side: input.side,
          gameType: input.gameType,
          notes: input.notes,
          source: "manual",
        },
      })
    : await prisma.match.create({
        data: {
          playedAt: input.playedAt,
          gameDurationSec: input.gameDurationSec,
          league: input.league,
          opponent: input.opponent,
          status: "PLAYED",
          result: input.result,
          side: input.side,
          gameType: input.gameType,
          notes: input.notes,
          source: "manual",
        },
      });

  if (matchId) {
    const existing = await prisma.matchParticipant.findMany({
      where: { matchId },
      select: { side: true, position: true, buildJson: true },
    });
    for (const part of existing) {
      if (!part.side) continue;
      const parsed = parseBuildJson(part.buildJson);
      if (parsed?.perks) {
        preservedPerksBySlot.set(slotKey(part.side, part.position), parsed.perks);
      }
    }
    await prisma.matchParticipant.deleteMany({ where: { matchId } });
  }

  for (const row of input.ourParticipants) {
    const preservedPerks = preservedPerksBySlot.get(slotKey(input.side, row.position));
    await prisma.matchParticipant.create({
      data: participantData(match.id, row.playerId!, row, input.side, preservedPerks),
    });
  }

  for (const row of input.enemyParticipants) {
    const playerId = await ensureOpponentPlayer(
      input.opponent,
      row,
      matchKey,
    );
    const preservedPerks = preservedPerksBySlot.get(slotKey(enemySide, row.position));
    await prisma.matchParticipant.create({
      data: participantData(match.id, playerId, row, enemySide, preservedPerks),
    });
  }

  await ensureOurTeamPickBans(match.id);

  return { id: match.id };
}
