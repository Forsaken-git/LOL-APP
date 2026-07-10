import { Card } from "@/components/ui/Card";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-inset/80 ${className}`}
      aria-hidden
    />
  );
}

export function PageSkeleton({
  title,
  statTiles = 0,
  cards = 2,
}: {
  title: string;
  statTiles?: number;
  cards?: number;
}) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label={`Loading ${title}`}>
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:mb-8 sm:pb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-xl font-semibold uppercase tracking-wide text-foreground sm:text-2xl lg:text-3xl">
            {title}
          </h1>
          <Shimmer className="mt-2 h-4 w-full max-w-md" />
        </div>
      </header>

      {statTiles > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: statTiles }).map((_, i) => (
            <Shimmer key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i}>
            <div className="space-y-3">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-20 w-full" />
              <Shimmer className="h-20 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
