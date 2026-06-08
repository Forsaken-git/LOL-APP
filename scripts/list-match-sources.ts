import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const bySource = await prisma.match.groupBy({
    by: ["source"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  console.log("=== Match counts by source ===\n");
  for (const row of bySource) {
    console.log(`${row.source ?? "(null / demo)"}: ${row._count.id}`);
  }

  const collectorLike = await prisma.match.findMany({
    where: {
      AND: [
        { source: { not: "manual" } },
        { source: { not: null } },
      ],
    },
    select: {
      id: true,
      playedAt: true,
      league: true,
      opponent: true,
      result: true,
      side: true,
      source: true,
      externalId: true,
      participants: {
        select: { champion: true, player: { select: { displayName: true } } },
        take: 5,
      },
    },
    orderBy: { playedAt: "desc" },
  });

  console.log(`\n=== Collector / import matches (${collectorLike.length}) ===\n`);
  for (const m of collectorLike) {
    const champs = m.participants.map((p) => p.champion).join(", ");
    console.log(
      [
        m.playedAt.toISOString().slice(0, 16),
        m.source,
        m.result ?? "?",
        `vs ${m.opponent ?? "?"}`,
        m.league,
        champs,
      ].join(" · "),
    );
  }

  const manual = await prisma.match.count({ where: { source: "manual" } });
  const noSource = await prisma.match.count({ where: { source: null } });
  console.log(`\nManual: ${manual} · No source (demo/unknown): ${noSource}`);

  const all = await prisma.match.findMany({
    select: {
      playedAt: true,
      source: true,
      opponent: true,
      league: true,
      participants: { select: { champion: true } },
    },
    orderBy: { playedAt: "desc" },
  });
  console.log(`\n=== All ${all.length} matches ===\n`);
  for (const m of all) {
    console.log(
      `${m.playedAt.toISOString().slice(0, 10)} · source=${m.source ?? "null"} · vs ${m.opponent} · ${m.participants.map((p) => p.champion).slice(0, 3).join(", ")}…`,
    );
  }
}

main().finally(() => prisma.$disconnect());
