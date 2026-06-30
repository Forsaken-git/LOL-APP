import type { Match, MatchParticipant, PickBan, Player } from "@prisma/client";
import { parseBuildJson } from "@/lib/items";
import { isOpponentPlaceholder } from "@/lib/players/team-player";
import { prisma } from "@/lib/prisma";
import type {
  IngestEvent,
  IngestMatch,
  IngestParticipant,
  IngestPayload,
  IngestPlayer,
} from "./types";

type MatchWithRelations = Match & {
  participants: (MatchParticipant & { player: Player })[];
  pickBans: PickBan[];
  mvp: Player | null;
};

function exportPlayer(row: Player): IngestPlayer {
  return {
    externalId: row.externalId ?? undefined,
    displayName: row.displayName,
    summonerName: row.summonerName ?? undefined,
    teamRole: row.teamRole,
    memberRole: row.memberRole,
    active: row.active,
  };
}

function exportParticipant(
  part: MatchParticipant & { player: Player },
): IngestParticipant {
  const opponent = isOpponentPlaceholder(part.player);
  const build = parseBuildJson(part.buildJson);

  return {
    ...(opponent
      ? {}
      : { playerExternalId: part.player.externalId ?? undefined }),
    displayName: part.player.displayName,
    summonerName: part.player.summonerName ?? undefined,
    champion: part.champion,
    side: part.side ?? undefined,
    opponent: opponent || undefined,
    teamRole: opponent ? part.player.teamRole : undefined,
    position: part.position ?? undefined,
    kills: part.kills ?? undefined,
    deaths: part.deaths ?? undefined,
    assists: part.assists ?? undefined,
    cs: part.cs ?? undefined,
    damage: part.damage ?? undefined,
    goldEarned: part.goldEarned ?? undefined,
    visionScore: part.visionScore ?? undefined,
    build: build ?? undefined,
  };
}

function exportMatch(row: MatchWithRelations): IngestMatch | null {
  if (!row.result) return null;

  return {
    externalId: row.externalId ?? undefined,
    playedAt: row.playedAt.toISOString(),
    league: row.league,
    opponent: row.opponent ?? undefined,
    result: row.result,
    side: row.side,
    gameType: row.gameType,
    gameDurationSec: row.gameDurationSec ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source ?? undefined,
    mvpExternalId: row.mvp?.externalId ?? undefined,
    mvpDisplayName: row.mvp?.displayName ?? undefined,
    participants: row.participants.map(exportParticipant),
    pickBans: row.pickBans.map((pb) => ({
      champion: pb.champion,
      type: pb.type,
      side: pb.side,
      order: pb.order,
    })),
  };
}

/** Serialize the database into an ingest payload (for backup / migration). */
export async function buildExportPayload(
  source = "hub-export",
): Promise<IngestPayload> {
  const [playerRows, matchRows, eventRows] = await Promise.all([
    prisma.player.findMany({
      where: {
        OR: [
          { externalId: null },
          { NOT: { externalId: { startsWith: "opponent:" } } },
        ],
      },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
    }),
    prisma.match.findMany({
      include: {
        participants: { include: { player: true } },
        pickBans: { orderBy: { order: "asc" } },
        mvp: true,
      },
      orderBy: { playedAt: "asc" },
    }),
    prisma.event.findMany({ orderBy: { startAt: "asc" } }),
  ]);

  const matches = matchRows
    .map(exportMatch)
    .filter((m): m is IngestMatch => m != null);

  const events: IngestEvent[] = eventRows.map((e) => ({
    externalId: e.externalId ?? undefined,
    title: e.title,
    type: e.type,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString(),
    description: e.description ?? undefined,
    location: e.location ?? undefined,
  }));

  return {
    source,
    players: playerRows.map(exportPlayer),
    matches,
    events,
  };
}
