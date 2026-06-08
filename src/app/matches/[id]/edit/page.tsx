import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { formatTime24 } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { sortPlayersByRoster } from "@/lib/player-sort";
import { expandBuildForEditor } from "@/lib/build-normalize";
import { parseBuildJson } from "@/lib/items";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ManualMatchForm,
  type ManualMatchFormInitial,
} from "@/components/matches/ManualMatchForm";

export const dynamic = "force-dynamic";

const LANE_POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

function laneIndex(position: string | null): number {
  const p = (position ?? "").toUpperCase();
  if (p === "TOP") return 0;
  if (p === "JUNGLE") return 1;
  if (p === "MIDDLE" || p === "MID") return 2;
  if (p === "BOTTOM" || p === "ADC") return 3;
  if (p === "UTILITY" || p === "SUPPORT") return 4;
  return 99;
}

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [rows, match] = await Promise.all([
    prisma.player.findMany({
      where: { active: true },
      select: {
        id: true,
        displayName: true,
        summonerName: true,
        teamRole: true,
        memberRole: true,
      },
    }),
    prisma.match.findUnique({
      where: { id },
      include: {
        participants: { include: { player: true } },
        pickBans: { orderBy: { order: "asc" } },
      },
    }),
  ]);
  if (!match) notFound();

  const players = sortPlayersByRoster(rows);
  const ourSide = match.side;
  const enemySide = ourSide === "BLUE" ? "RED" : "BLUE";
  const ourParts = match.participants
    .filter((p) => p.side === ourSide)
    .sort((a, b) => laneIndex(a.position) - laneIndex(b.position));
  const enemyParts = match.participants
    .filter((p) => p.side === enemySide)
    .sort((a, b) => laneIndex(a.position) - laneIndex(b.position));
  const enemyPickFallback = match.pickBans
    .filter((pb) => pb.type === "PICK" && pb.side === enemySide)
    .map((pb) => pb.champion);

  const initial: ManualMatchFormInitial = {
    date: format(match.playedAt, "yyyy-MM-dd"),
    time: formatTime24(match.playedAt),
    gameDuration:
      match.gameDurationSec && match.gameDurationSec > 0
        ? `${Math.floor(match.gameDurationSec / 60)}:${String(match.gameDurationSec % 60).padStart(2, "0")}`
        : "",
    league: match.league,
    opponent: match.opponent ?? "",
    result: match.result ?? "LOSS",
    side: match.side,
    gameType: match.gameType,
    notes: match.notes ?? "",
    ourRows: Array.from({ length: 5 }).map((_, i) => {
      const part = ourParts[i];
      const build = parseBuildJson(part?.buildJson ?? null);
      const { itemIds, trinketItemId } = expandBuildForEditor(build, {
        position: part?.position ?? LANE_POSITIONS[i],
        laneIndex: i,
      });
      return {
        playerId: part?.playerId ?? "",
        champion: part?.champion ?? "",
        kills: part?.kills != null ? String(part.kills) : "",
        deaths: part?.deaths != null ? String(part.deaths) : "",
        assists: part?.assists != null ? String(part.assists) : "",
        cs: part?.cs != null ? String(part.cs) : "",
        damage: part?.damage != null ? String(part.damage) : "",
        goldEarned: part?.goldEarned != null ? String(part.goldEarned) : "",
        visionScore: part?.visionScore != null ? String(part.visionScore) : "",
        itemSlots: Array.from({ length: 7 }).map((_, idx) => String(itemIds[idx] ?? "")),
        trinketId: trinketItemId,
        spell1Id: build?.spell1Id != null ? String(build.spell1Id) : "",
        spell2Id: build?.spell2Id != null ? String(build.spell2Id) : "",
        keystoneId: build?.perks?.slots?.[0] != null ? String(build.perks.slots[0]) : "",
        primaryStyleId:
          build?.perks?.primaryStyle != null ? String(build.perks.primaryStyle) : "",
        subStyleId: build?.perks?.subStyle != null ? String(build.perks.subStyle) : "",
      };
    }),
    enemyRows: Array.from({ length: 5 }).map((_, i) => {
      const part = enemyParts[i];
      const build = parseBuildJson(part?.buildJson ?? null);
      const { itemIds, trinketItemId } = expandBuildForEditor(build, {
        position: part?.position ?? LANE_POSITIONS[i],
        laneIndex: i,
      });
      return {
        label: part?.player.displayName ?? "",
        champion: part?.champion ?? enemyPickFallback[i] ?? "",
        kills: part?.kills != null ? String(part.kills) : "",
        deaths: part?.deaths != null ? String(part.deaths) : "",
        assists: part?.assists != null ? String(part.assists) : "",
        cs: part?.cs != null ? String(part.cs) : "",
        damage: part?.damage != null ? String(part.damage) : "",
        goldEarned: part?.goldEarned != null ? String(part.goldEarned) : "",
        visionScore: part?.visionScore != null ? String(part.visionScore) : "",
        itemSlots: Array.from({ length: 7 }).map((_, idx) => String(itemIds[idx] ?? "")),
        trinketId: trinketItemId,
        spell1Id: build?.spell1Id != null ? String(build.spell1Id) : "",
        spell2Id: build?.spell2Id != null ? String(build.spell2Id) : "",
        keystoneId: build?.perks?.slots?.[0] != null ? String(build.perks.slots[0]) : "",
        primaryStyleId:
          build?.perks?.primaryStyle != null ? String(build.perks.primaryStyle) : "",
        subStyleId: build?.perks?.subStyle != null ? String(build.perks.subStyle) : "",
      };
    }),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Edit match"
        description="Fix missing players, champions, and stats"
      >
        <Link href="/matches" className="btn-ghost text-sm">
          Back to matches
        </Link>
      </PageHeader>
      <ManualMatchForm players={players} matchId={id} initial={initial} />
    </div>
  );
}
