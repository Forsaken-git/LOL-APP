import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DrafterTool } from "@/components/drafter/DrafterTool";

export const dynamic = "force-dynamic";

export default async function DrafterPage() {
  const saved = await prisma.draftSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Draft Practice"
        description="Build compositions — save drafts for review with coaches"
      />

      <Card title="Draft board">
        <DrafterTool />
      </Card>

      {saved.length > 0 && (
        <Card title="Saved drafts">
          <ul className="space-y-3 text-sm">
            {saved.map((d) => {
              const bluePicks = JSON.parse(d.bluePicks) as string[];
              const redPicks = JSON.parse(d.redPicks) as string[];
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-border bg-inset px-4 py-3"
                >
                  <p className="font-medium text-foreground">{d.name}</p>
                  <p className="text-xs text-muted">
                    {format(d.createdAt, "MMM d, yyyy HH:mm")} · Blue:{" "}
                    {bluePicks.join(", ") || "—"} · Red:{" "}
                    {redPicks.join(", ") || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
