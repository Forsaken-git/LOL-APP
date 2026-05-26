import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { TierlistEditor } from "@/components/tierlists/TierlistEditor";

export const dynamic = "force-dynamic";

export default async function TierlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tierlist = await prisma.tierlist.findUnique({ where: { id } });
  if (!tierlist) notFound();

  const parsed = JSON.parse(tierlist.rows) as Record<string, string[]>;
  const rows = {
    S: parsed.S ?? [],
    A: parsed.A ?? [],
    B: parsed.B ?? [],
    C: parsed.C ?? [],
    D: parsed.D ?? [],
  };

  return (
    <div className="space-y-6">
      <Link href="/tierlists" className="link-accent inline-block">
        ← Tierlists
      </Link>
      <Card>
        <TierlistEditor id={tierlist.id} name={tierlist.name} initialRows={rows} />
      </Card>
    </div>
  );
}
