import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeScenarioInput,
  scenarioFromRow,
  scenarioToRowData,
} from "@/lib/draft-prep/db-sync";
import type { DraftPrepScenario } from "@/lib/draft-prep/storage";
import { PREP_GRID_COLS, PREP_GRID_ROWS } from "@/lib/draft-prep/scenario-layout";

export const dynamic = "force-dynamic";

function validateScenarios(raw: unknown): DraftPrepScenario[] | null {
  if (!raw || !Array.isArray(raw)) return null;

  const scenarios: DraftPrepScenario[] = [];
  const cells = new Set<string>();

  for (const item of raw) {
    const scenario = normalizeScenarioInput(item);
    if (!scenario) return null;
    if (
      scenario.col < 0 ||
      scenario.col >= PREP_GRID_COLS ||
      scenario.row < 0 ||
      scenario.row >= PREP_GRID_ROWS
    ) {
      return null;
    }
    const key = `${scenario.col},${scenario.row}`;
    if (cells.has(key)) return null;
    cells.add(key);
    scenarios.push(scenario);
  }

  return scenarios;
}

export async function GET() {
  const rows = await prisma.draftPrepScenario.findMany({
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });

  return NextResponse.json({
    scenarios: rows.map(scenarioFromRow),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { scenarios?: unknown };
  const scenarios = validateScenarios(body.scenarios);
  if (!scenarios) {
    return NextResponse.json({ error: "Invalid scenarios payload" }, { status: 400 });
  }

  const ids = scenarios.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    if (ids.length === 0) {
      await tx.draftPrepScenario.deleteMany();
    } else {
      await tx.draftPrepScenario.deleteMany({
        where: { id: { notIn: ids } },
      });
    }

    for (const scenario of scenarios) {
      const data = scenarioToRowData(scenario);
      await tx.draftPrepScenario.upsert({
        where: { id: scenario.id },
        create: data,
        update: data,
      });
    }
  });

  return NextResponse.json({ ok: true, count: scenarios.length });
}
