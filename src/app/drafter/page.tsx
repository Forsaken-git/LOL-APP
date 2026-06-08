import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { GameDraftWorkbench } from "@/components/drafter/GameDraftWorkbench";
import { isDraftComplete, parseDraftEntries } from "@/lib/draft";
import { CHAMPIONS } from "@/lib/champions";

export const dynamic = "force-dynamic";

export default async function DrafterPage() {
  const rows = await prisma.draftSession.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 30,
  });

  // Role/tab support in the champion picker is inferred from match lane data.
  const championSet = new Set(CHAMPIONS as unknown as string[]);
  const roleKeys = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
  type RoleKey = (typeof roleKeys)[number];

  function roleFromPosition(position: string | null): RoleKey | null {
    if (!position) return null;
    const p = position.toUpperCase();
    if (p === "TOP") return "TOP";
    if (p === "JUNGLE") return "JUNGLE";
    if (p === "MIDDLE" || p === "MID") return "MID";
    if (p === "BOTTOM" || p === "ADC") return "ADC";
    if (p === "UTILITY" || p === "SUPPORT") return "SUPPORT";
    return null;
  }

  const grouped = await prisma.matchParticipant.groupBy({
    by: ["champion", "position"],
    where: { position: { not: null } },
    _count: { _all: true },
  });

  const roleCountsByChampion: Record<string, Record<RoleKey, number>> = {};
  const totalByChampion: Record<string, number> = {};

  for (const row of grouped) {
    const champion = row.champion;
    if (!championSet.has(champion)) continue;
    const role = roleFromPosition(row.position as unknown as string | null);
    if (!role) continue;

    if (!roleCountsByChampion[champion]) {
      roleCountsByChampion[champion] = {
        TOP: 0,
        JUNGLE: 0,
        MID: 0,
        ADC: 0,
        SUPPORT: 0,
      };
    }

    const n = row._count._all;
    roleCountsByChampion[champion][role] += n;
    totalByChampion[champion] = (totalByChampion[champion] ?? 0) + n;
  }

  const primaryRoleByChampion: Record<string, RoleKey | null> = {};
  for (const [champion, counts] of Object.entries(roleCountsByChampion)) {
    let best: RoleKey | null = null;
    let bestScore = -1;
    for (const r of roleKeys) {
      const score = counts[r] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    primaryRoleByChampion[champion] = best;
  }

  const initialDrafts = rows.map((d) => {
    const entries = parseDraftEntries(d.pickBans);
    return {
      id: d.id,
      title: d.title,
      opponent: d.opponent,
      league: d.league,
      scheduledAt: d.scheduledAt.toISOString(),
      ourSide: d.ourSide,
      status: d.status,
      notes: d.notes,
      matchId: d.matchId,
      entries,
      progress: entries.length,
      complete: isDraftComplete(entries),
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Game drafts"
        description="Plan upcoming games and capture pick/ban data for stats"
      />

      <section className="rounded-2xl border border-border bg-surface/90 p-3 shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:p-4">
        <GameDraftWorkbench
          initialDrafts={initialDrafts}
          championRoleData={{
            roleCountsByChampion: roleCountsByChampion as any,
            primaryRoleByChampion: primaryRoleByChampion as any,
            totalByChampion: totalByChampion as any,
          }}
        />
      </section>
    </div>
  );
}
