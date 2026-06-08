import { startOfDay } from "date-fns";
import { formatDateTime24Weekday } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { computeTeamStats } from "@/lib/stats";
import { buildEncounterSummaries } from "@/lib/match-encounters";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { OverviewCalendar } from "@/components/dashboard/OverviewCalendar";
import { RecentMatches } from "@/components/dashboard/RecentMatches";
import { SyncStatus } from "@/components/dashboard/SyncStatus";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [playedMatches, recentMatchRows, upcomingEvents] = await Promise.all([
    prisma.match.findMany({
      where: { status: "PLAYED" },
      select: { result: true, side: true },
    }),
    prisma.match.findMany({
      orderBy: { playedAt: "desc" },
      take: 60,
      select: {
        id: true,
        playedAt: true,
        league: true,
        opponent: true,
        side: true,
        result: true,
      },
    }),
    prisma.event.findMany({
      where: { startAt: { gte: startOfDay(new Date()) } },
      orderBy: { startAt: "asc" },
      take: 4,
    }),
  ]);

  const stats = computeTeamStats(playedMatches);
  const recentEncounters = buildEncounterSummaries(
    recentMatchRows.filter(
      (m): m is typeof m & { result: NonNullable<typeof m.result> } =>
        m.result != null,
    ),
    5,
  ).map((e) => ({
    ...e,
    playedAt: e.playedAt.toISOString(),
    games: e.games.map((g) => ({ ...g, playedAt: g.playedAt.toISOString() })),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team Overview"
        description="CWL & Titans record, side win rates, and recent activity"
      >
        <SyncStatus />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Games" value={String(stats.total)} />
        <StatTile label="Wins" value={String(stats.wins)} accent="win" />
        <StatTile label="Losses" value={String(stats.losses)} accent="loss" />
        <StatTile label="Win rate" value={`${stats.winRate}%`} accent="accent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <OverviewCalendar />
        </div>

        <Card title="Side win rate" className="lg:col-span-2">
          <p className="mb-4 text-xs text-muted">
            Played games (all types) · {stats.total} total
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <SideBar
              label="Blue side"
              wins={stats.blue.wins}
              total={stats.blue.total}
              winRate={stats.blue.winRate}
              color="blue"
              large
            />
            <SideBar
              label="Red side"
              wins={stats.red.wins}
              total={stats.red.total}
              winRate={stats.red.winRate}
              color="red"
              large
            />
          </div>
          {stats.total > 0 && (
            <p className="mt-5 border-t border-border pt-4 text-center text-sm text-muted">
              {stats.blue.winRate > stats.red.winRate
                ? "Stronger on blue"
                : stats.red.winRate > stats.blue.winRate
                  ? "Stronger on red"
                  : "Even on both sides"}
              {" · "}
              <span className="tabular-nums text-foreground">
                {Math.abs(stats.blue.winRate - stats.red.winRate)}%
              </span>{" "}
              gap
            </p>
          )}
        </Card>

        <Card title="Upcoming" className="lg:col-span-1">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium text-foreground">{e.title}</p>
                  <p className="text-muted">
                    {formatDateTime24Weekday(e.startAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <RecentMatches encounters={recentEncounters} />
    </div>
  );
}

function SideBar({
  label,
  wins,
  total,
  winRate,
  color,
  large = false,
}: {
  label: string;
  wins: number;
  total: number;
  winRate: number;
  color: "blue" | "red";
  large?: boolean;
}) {
  const barColor = color === "blue" ? "bg-sky-500" : "bg-rose-500";
  const losses = total - wins;
  const sideTint =
    color === "blue" ? "border-sky-500/25 bg-sky-500/5" : "border-rose-500/25 bg-rose-500/5";

  return (
    <div
      className={`rounded-xl border p-4 ${sideTint} ${large ? "min-h-[7.5rem]" : ""}`}
    >
      <div className="mb-3 flex items-end justify-between gap-2">
        <span className={`font-semibold text-foreground ${large ? "text-base" : "text-sm"}`}>
          {label}
        </span>
        <span
          className={`font-bold tabular-nums ${large ? "text-3xl" : "text-lg"} ${
            color === "blue" ? "text-sky-400" : "text-rose-400"
          }`}
        >
          {winRate}%
        </span>
      </div>
      <div
        className={`progress-track overflow-hidden rounded-full ${large ? "h-3" : "h-2"}`}
      >
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${winRate}%` }}
        />
      </div>
      <p className={`mt-2 tabular-nums text-muted ${large ? "text-sm" : "text-xs"}`}>
        {wins}W · {losses}L · {total} games
      </p>
    </div>
  );
}
