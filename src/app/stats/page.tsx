import { PageHeader } from "@/components/ui/PageHeader";
import { SoloQStatsView } from "@/components/stats/SoloQStatsView";
import { loadSoloQRosterStats } from "@/lib/stats/soloq-roster";

/** Avoid build-time prerender against Turso before schema patches are applied. */
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await loadSoloQRosterStats();

  return (
    <div>
      <PageHeader
        title="Stats"
        description="Live Solo Queue ranks for active roster Riot IDs (EUW / EUNE)."
      />
      <SoloQStatsView initial={stats} />
    </div>
  );
}
