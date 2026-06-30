import { parseDraftEntries, serializeDraftEntries } from "@/lib/draft";
import type { DraftPrepScenario, PrepExtraBanSlot } from "@/lib/draft-prep/storage";
import type { DraftPrepScenario as DraftPrepScenarioRow } from "@prisma/client";

function parseExtraBanSlots(raw: string): PrepExtraBanSlot[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((slot) => ({
      id: String((slot as PrepExtraBanSlot).id),
      turnIndex: Number((slot as PrepExtraBanSlot).turnIndex),
      side: (slot as PrepExtraBanSlot).side === "RED" ? "RED" : "BLUE",
      label: String((slot as PrepExtraBanSlot).label),
      champion:
        typeof (slot as PrepExtraBanSlot).champion === "string" &&
        (slot as PrepExtraBanSlot).champion!.trim()
          ? (slot as PrepExtraBanSlot).champion
          : null,
    }));
  } catch {
    return [];
  }
}

export function scenarioFromRow(row: DraftPrepScenarioRow): DraftPrepScenario {
  return {
    id: row.id,
    title: row.title,
    col: row.col,
    row: row.row,
    pickBans: parseDraftEntries(row.pickBans),
    extraBanSlots: parseExtraBanSlots(row.extraBanSlots),
    notes: row.notes ?? "",
  };
}

export function scenarioToRowData(scenario: DraftPrepScenario) {
  return {
    id: scenario.id,
    title: scenario.title.trim() || "SCENARIO",
    col: scenario.col,
    row: scenario.row,
    pickBans: serializeDraftEntries(scenario.pickBans),
    extraBanSlots: JSON.stringify(scenario.extraBanSlots ?? []),
    notes: scenario.notes ?? "",
  };
}

export function normalizeScenarioInput(raw: unknown): DraftPrepScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<DraftPrepScenario>;
  if (typeof s.id !== "string" || !s.id.trim()) return null;
  if (typeof s.title !== "string") return null;
  if (typeof s.col !== "number" || typeof s.row !== "number") return null;

  const pickBans = parseDraftEntries(
    typeof s.pickBans === "string"
      ? s.pickBans
      : JSON.stringify(s.pickBans ?? []),
  );

  const extraBanSlots = Array.isArray(s.extraBanSlots)
    ? s.extraBanSlots.map((slot) => ({
        id: String(slot.id),
        turnIndex: Number(slot.turnIndex),
        side: slot.side === "RED" ? ("RED" as const) : ("BLUE" as const),
        label: String(slot.label),
        champion:
          typeof slot.champion === "string" && slot.champion.trim()
            ? slot.champion
            : null,
      }))
    : [];

  return {
    id: s.id.trim(),
    title: s.title,
    col: s.col,
    row: s.row,
    pickBans,
    extraBanSlots,
    notes: typeof s.notes === "string" ? s.notes : "",
  };
}
