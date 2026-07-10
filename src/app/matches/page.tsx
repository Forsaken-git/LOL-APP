import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isCompetitionId, matchWhereForCompetition } from "@/lib/competitions";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Suspense } from "react";
import { MatchesFilter } from "@/components/matches/MatchesFilter";
import { MatchesList } from "@/components/matches/MatchesList";

export const revalidate = 30;

const MATCHES_LIST_LIMIT = 50;

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string; league?: string }>;
}) {
  const { competition, league } = await searchParams;

  const where = competition && isCompetitionId(competition)
    ? matchWhereForCompetition(competition)
    : league
      ? { league }
      : undefined;

  const matches = await prisma.match.findMany({
    where,
    orderBy: { playedAt: "desc" },
    take: MATCHES_LIST_LIMIT,
    select: {
      id: true,
      playedAt: true,
      league: true,
      opponent: true,
      result: true,
      status: true,
      side: true,
      gameType: true,
    },
  });

  const filterCurrent =
    competition && isCompetitionId(competition) ? competition : undefined;

  const listItems = matches.map((m) => ({
    id: m.id,
    playedAt: m.playedAt.toISOString(),
    league: m.league,
    opponent: m.opponent,
    result: m.result,
    status: m.status,
    side: m.side,
    gameType: m.gameType,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Matches"
        description="Full history — filter by competition"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/matches/new" className="btn-primary text-sm">
            Add match
          </Link>
          <Suspense fallback={<span className="text-xs text-muted">Loading…</span>}>
            <MatchesFilter current={filterCurrent} />
          </Suspense>
        </div>
      </PageHeader>

      {listItems.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No matches found.</p>
        </Card>
      ) : (
        <MatchesList matches={listItems} />
      )}
    </div>
  );
}
