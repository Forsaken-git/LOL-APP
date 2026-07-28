import { PageHeader } from "@/components/ui/PageHeader";
import { SoloQStatsView } from "@/components/stats/SoloQStatsView";
import { loadSoloQRosterStats } from "@/lib/stats/soloq-roster";

export const revalidate = 300;

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
