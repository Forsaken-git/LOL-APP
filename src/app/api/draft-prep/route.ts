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
  try {
    const rows = await prisma.draftPrepScenario.findMany({
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });

    return NextResponse.json({
      scenarios: rows.map(scenarioFromRow),
    });
  } catch (error) {
    console.error("[draft-prep GET]", error);
    return NextResponse.json(
      {
        error:
          "Draft Prep table missing. Run prisma/draft-prep-scenarios.sql on Turso.",
        scenarios: [],
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { scenarios?: unknown };
    const scenarios = validateScenarios(body.scenarios);
    if (!scenarios) {
      return NextResponse.json({ error: "Invalid scenarios payload" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.draftPrepScenario.deleteMany();
      if (scenarios.length > 0) {
        await tx.draftPrepScenario.createMany({
          data: scenarios.map(scenarioToRowData),
        });
      }
    });

    return NextResponse.json({ ok: true, count: scenarios.length });
  } catch (error) {
    console.error("[draft-prep PUT]", error);
    const raw = error instanceof Error ? error.message : String(error);
    let message = "Failed to save draft prep";
    if (raw.includes("no such table")) {
      message =
        "Draft Prep table missing. Run prisma/draft-prep-scenarios.sql on Turso.";
    } else if (
      raw.includes("write permission") ||
      raw.includes("write operations are forbidden")
    ) {
      message =
        "Turso token is read-only. In Vercel, set TURSO_AUTH_TOKEN to a read-write database token (Turso → database → Connect → full access token), then redeploy.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
