import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default function Loading() {
  return <PageSkeleton title="Team Overview" statTiles={4} cards={3} />;
}
