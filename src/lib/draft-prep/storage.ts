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

export function saveDraftPrepState(state: DraftPrepState): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      scenarios: state.scenarios.map((s) => ({
        ...s,
        pickBans: serializeDraftEntries(s.pickBans),
        extraBanSlots: s.extraBanSlots ?? [],
      })),
    }),
  );
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
