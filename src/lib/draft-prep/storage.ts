import type { DraftEntry } from "@/lib/draft";
import type { Side } from "@prisma/client";
import { parseDraftEntries, serializeDraftEntries } from "@/lib/draft";

export type PrepExtraBanSlot = {
  id: string;
  turnIndex: number;
  side: Side;
  label: string;
  champion: string | null;
};

export type DraftPrepScenario = {
  id: string;
  title: string;
  col: number;
  row: number;
  pickBans: DraftEntry[];
  extraBanSlots: PrepExtraBanSlot[];
  notes: string;
};

export type DraftPrepState = {
  scenarios: DraftPrepScenario[];
};

const STORAGE_KEY = "renim-draft-prep-v1";

export const DRAFT_PREP_STORAGE_KEY = STORAGE_KEY;

export function loadDraftPrepState(): DraftPrepState {
  if (typeof window === "undefined") return { scenarios: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { scenarios: [] };
    const parsed = JSON.parse(raw) as DraftPrepState;
    if (!parsed?.scenarios || !Array.isArray(parsed.scenarios)) {
      return { scenarios: [] };
    }
    return {
      scenarios: parsed.scenarios.map((s) => ({
        ...s,
        pickBans: parseDraftEntries(
          typeof s.pickBans === "string"
            ? s.pickBans
            : JSON.stringify(s.pickBans ?? []),
        ),
        extraBanSlots: Array.isArray(s.extraBanSlots)
          ? s.extraBanSlots.map((slot) => ({
              id: String(slot.id),
              turnIndex: Number(slot.turnIndex),
              side: slot.side === "RED" ? "RED" : "BLUE",
              label: String(slot.label),
              champion:
                typeof slot.champion === "string" && slot.champion.trim()
                  ? slot.champion
                  : null,
            }))
          : [],
        notes: s.notes ?? "",
      })),
    };
  } catch {
    return { scenarios: [] };
  }
}

export function clearDraftPrepLocalCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function fetchDraftPrepScenarios(): Promise<DraftPrepScenario[]> {
  const res = await fetch("/api/draft-prep");
  if (!res.ok) throw new Error("Failed to load draft prep");
  const data = (await res.json()) as { scenarios: unknown };
  if (!Array.isArray(data.scenarios)) return [];
  return data.scenarios
    .map((s) => normalizeScenarioFromStorage(s))
    .filter((s): s is DraftPrepScenario => s != null);
}

export async function saveDraftPrepScenarios(
  scenarios: DraftPrepScenario[],
): Promise<void> {
  const res = await fetch("/api/draft-prep", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarios }),
  });
  if (!res.ok) throw new Error("Failed to save draft prep");
}

function normalizeScenarioFromStorage(raw: unknown): DraftPrepScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<DraftPrepScenario>;
  if (typeof s.id !== "string" || typeof s.title !== "string") return null;
  if (typeof s.col !== "number" || typeof s.row !== "number") return null;
  return {
    id: s.id,
    title: s.title,
    col: s.col,
    row: s.row,
    pickBans: parseDraftEntries(
      typeof s.pickBans === "string"
        ? s.pickBans
        : JSON.stringify(s.pickBans ?? []),
    ),
    extraBanSlots: Array.isArray(s.extraBanSlots)
      ? s.extraBanSlots.map((slot) => ({
          id: String(slot.id),
          turnIndex: Number(slot.turnIndex),
          side: slot.side === "RED" ? "RED" : "BLUE",
          label: String(slot.label),
          champion:
            typeof slot.champion === "string" && slot.champion.trim()
              ? slot.champion
              : null,
        }))
      : [],
    notes: s.notes ?? "",
  };
}

export function nextScenarioTitle(scenarios: DraftPrepScenario[]): string {
  const n =
    scenarios.reduce((max, s) => {
      const m = /^SCENARIO\s+(\d+)$/i.exec(s.title.trim());
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;
  return `SCENARIO ${n}`;
}

export function newScenarioId(): string {
  return `prep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newExtraBanSlotId(): string {
  return `extra-ban-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
