import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { championImageUrl } from "@/lib/champions";
import { COMPETITIONS, competitionForLeague, type CompetitionId } from "@/lib/competitions";
import { sortPlayersByRoster } from "@/lib/player-sort";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const rows = await prisma.player.findMany({
    where: { active: true },
    include: {
      participations: {
        include: { match: true },
      },
    },
  });

  const players = sortPlayersByRoster(rows);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Players"
        description="Active roster — champion pools by competition"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {players.map((player) => {
          const pools = Object.fromEntries(
            COMPETITIONS.map((c) => [
              c.id,
              championCounts(participationsFor(player.participations, c.id)),
            ]),
          ) as Record<CompetitionId, { champion: string; count: number }[]>;

          const isSub = player.memberRole === "SUB";

          return (
            <Card key={player.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {player.displayName}
                  </h3>
                  <p className="text-sm text-muted">
                    {formatRole(player.teamRole)}
                    {player.summonerName ? ` · ${player.summonerName}` : ""}
                  </p>
                </div>
                <Badge variant={isSub ? "default" : "blue"}>
                  {isSub ? "Sub" : "Starter"}
                </Badge>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {COMPETITIONS.map((c) => (
                  <ChampPool key={c.id} title={c.label} champs={pools[c.id]} />
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatRole(role: string): string {
  if (role === "JUNGLE") return "Jungle";
  if (role === "ADC") return "ADC";
  if (role === "SUPPORT") return "Support";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function participationsFor(
  parts: { champion: string; match: { league: string; gameType: string } }[],
  id: CompetitionId,
) {
  return parts.filter((p) => {
    const comp = competitionForLeague(p.match.league);
    if (comp) return comp.id === id;
    if (id === "scrim") {
      return p.match.gameType === "SCRIM" || p.match.gameType === "TRAINING";
    }
    return false;
  });
}

function championCounts(
  parts: { champion: string }[],
): { champion: string; count: number }[] {
  const map = parts.reduce(
    (acc, p) => {
      acc[p.champion] = (acc[p.champion] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return Object.entries(map)
    .map(([champion, count]) => ({ champion, count }))
    .sort((a, b) => b.count - a.count);
}

function ChampPool({
  title,
  champs,
}: {
  title: string;
  champs: { champion: string; count: number }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-bright">
        {title}
      </p>
      {champs.length === 0 ? (
        <p className="text-xs text-faint">—</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {champs.map(({ champion, count }) => (
            <div
              key={champion}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-inset px-2 py-1"
              title={`${count} games`}
            >
              <img
                src={championImageUrl(champion)}
                alt=""
                className="h-6 w-6 rounded-md"
              />
              <span className="text-xs text-foreground">{champion}</span>
              <span className="text-[10px] text-muted">×{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
