import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { sortPlayersByRoster } from "@/lib/player-sort";
import { PageHeader } from "@/components/ui/PageHeader";
import { ManualMatchForm } from "@/components/matches/ManualMatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const rows = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      displayName: true,
      summonerName: true,
      teamRole: true,
      memberRole: true,
    },
  });

  const players = sortPlayersByRoster(rows);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add match"
        description="Enter game results, player stats, and optional draft data"
      >
        <Link href="/matches" className="btn-ghost text-sm">
          Back to matches
        </Link>
      </PageHeader>

      {players.length === 0 ? (
        <p className="text-sm text-muted">
          No active players on the roster. Add players before logging a match.
        </p>
      ) : (
        <ManualMatchForm players={players} />
      )}
    </div>
  );
}
