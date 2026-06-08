import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { championDisplayName, championImageUrl } from "@/lib/champions";
import { isDraftComplete, parseDraftEntries } from "@/lib/draft";

export const dynamic = "force-dynamic";

export default async function PicksBansPage() {
  const [matchPickBans, drafts, playedMatchesCount] = await Promise.all([
    prisma.pickBan.findMany({
      where: { match: { is: {} } },
      include: { match: true },
    }),
    prisma.draftSession.findMany({
      select: { pickBans: true, ourSide: true, matchId: true },
    }),
    prisma.match.count({
      where: { status: "PLAYED" },
    }),
  ]);

  const draftEntries = drafts.flatMap((d) => {
    // Priority rule: when draft is linked to a match, count only match data.
    if (d.matchId) return [];
    const entries = parseDraftEntries(d.pickBans);
    if (!isDraftComplete(entries)) return [];
    return entries.filter((e) => e.side === d.ourSide);
  });

  const ourMatchPickBans = matchPickBans.filter((p) => p.side === p.match.side);

  const pickBans = [
    ...ourMatchPickBans.map((p) => ({ champion: p.champion, type: p.type })),
    ...draftEntries.map((e) => ({ champion: e.champion, type: e.type })),
  ];
  const normalizedPickBans = pickBans.map((p) => ({
    ...p,
    champion: championDisplayName(p.champion),
  }));

  const pickCounts = countByChampion(
    normalizedPickBans.filter((p) => p.type === "PICK"),
  );
  const banCounts = countByChampion(
    normalizedPickBans.filter((p) => p.type === "BAN"),
  );

  const topPicks = sortCounts(pickCounts).slice(0, 10);
  const topBans = sortCounts(banCounts).slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Picks & Bans"
        description="Most picked and banned champions from played games and upcoming drafts"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChampionList title="Most picked" items={topPicks} accent="pick" />
        <ChampionList title="Most banned" items={topBans} accent="ban" />
      </div>

      <Card title="Raw totals">
        <p className="text-sm text-muted">
          Based on {pickBans.length} pick/ban entries from{" "}
          {playedMatchesCount} played matches{" "}
          <span className="text-faint">
            ({new Set(ourMatchPickBans.map((p) => p.matchId)).size} matches with our pick/ban rows)
          </span>{" "}
          and{" "}
          {drafts.length} drafts (our side only).
        </p>
      </Card>
    </div>
  );
}

function countByChampion(
  entries: { champion: string }[],
): Record<string, number> {
  return entries.reduce(
    (acc, e) => {
      acc[e.champion] = (acc[e.champion] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

function sortCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([champion, count]) => ({ champion, count }))
    .sort((a, b) => b.count - a.count);
}

function ChampionList({
  title,
  items,
  accent,
}: {
  title: string;
  items: { champion: string; count: number }[];
  accent: "pick" | "ban";
}) {
  const max = items[0]?.count ?? 1;
  const barClass = accent === "pick" ? "bg-emerald-500" : "bg-rose-500";

  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No data yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(({ champion, count }, i) => (
            <li key={champion} className="flex items-center gap-3">
              <span className="w-5 text-xs tabular-nums text-faint">{i + 1}</span>
              <img
                src={championImageUrl(champion)}
                alt=""
                className="champion-icon"
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{champion}</span>
                  <span className="tabular-nums text-muted">{count}</span>
                </div>
                <div className="progress-track mt-1 h-1.5 overflow-hidden rounded-full">
                  <div
                    className={`h-full ${barClass}`}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
