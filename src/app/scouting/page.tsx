import { PageHeader } from "@/components/ui/PageHeader";
import { ScoutingView } from "@/components/scouting/ScoutingView";

export default function ScoutingPage() {
  return (
    <div>
      <PageHeader
        title="Scouting"
        description="Paste an OP.GG multisearch or Riot IDs to pull ranked champ pools, KDA, and winrates. The last report stays on this device until you clear or re-scout."
      />
      <ScoutingView />
    </div>
  );
}
