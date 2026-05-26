import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewTierlistForm } from "@/components/tierlists/TierlistEditor";

export const dynamic = "force-dynamic";

export default async function TierlistsPage() {
  const tierlists = await prisma.tierlist.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tierlists"
        description="Champion pools for meta, scrims, and patch notes"
      >
        <NewTierlistForm />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {tierlists.map((t) => {
          const rows = JSON.parse(t.rows) as Record<string, string[]>;
          const total = Object.values(rows).flat().length;
          return (
            <Link key={t.id} href={`/tierlists/${t.id}`}>
              <Card className="transition-all hover:border-accent/30 hover:shadow-[0_0_24px_rgba(139,124,246,0.08)]">
                <h3 className="font-semibold text-foreground">{t.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {total} champions · Updated {format(t.updatedAt, "MMM d, yyyy")}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
