import type { PickBanType, Side } from "@prisma/client";

export type DraftEntry = {
  champion: string;
  type: PickBanType;
  side: Side;
  order: number;
};

export type DraftTurn = {
  side: Side;
  type: PickBanType;
  label: string;
  slotLabel: string;
};

/** Standard competitive draft order (6 bans + 5 picks per side). */
export const DRAFT_TURNS: DraftTurn[] = [
  { side: "BLUE", type: "BAN", label: "Blue ban 1", slotLabel: "BAN 1" },
  { side: "RED", type: "BAN", label: "Red ban 1", slotLabel: "BAN 2" },
  { side: "BLUE", type: "BAN", label: "Blue ban 2", slotLabel: "BAN 3" },
  { side: "RED", type: "BAN", label: "Red ban 2", slotLabel: "BAN 4" },
  { side: "BLUE", type: "BAN", label: "Blue ban 3", slotLabel: "BAN 5" },
  { side: "RED", type: "BAN", label: "Red ban 3", slotLabel: "BAN 6" },
  { side: "BLUE", type: "PICK", label: "Blue pick 1", slotLabel: "B1" },
  { side: "RED", type: "PICK", label: "Red pick 1", slotLabel: "R1" },
  { side: "RED", type: "PICK", label: "Red pick 2", slotLabel: "R2" },
  { side: "BLUE", type: "PICK", label: "Blue pick 2", slotLabel: "B2" },
  { side: "BLUE", type: "PICK", label: "Blue pick 3", slotLabel: "B3" },
  { side: "RED", type: "PICK", label: "Red pick 3", slotLabel: "R3" },
  { side: "RED", type: "BAN", label: "Red ban 4", slotLabel: "BAN 8" },
  { side: "BLUE", type: "BAN", label: "Blue ban 4", slotLabel: "BAN 7" },
  { side: "RED", type: "BAN", label: "Red ban 5", slotLabel: "BAN 9" },
  { side: "BLUE", type: "BAN", label: "Blue ban 5", slotLabel: "BAN 10" },
  { side: "RED", type: "PICK", label: "Red pick 4", slotLabel: "R4" },
  { side: "BLUE", type: "PICK", label: "Blue pick 4", slotLabel: "B4" },
  { side: "BLUE", type: "PICK", label: "Blue pick 5", slotLabel: "B5" },
  { side: "RED", type: "PICK", label: "Red pick 5", slotLabel: "R5" },
];

export type DraftSlotRef = { turnIndex: number };

export type DraftBanPhaseLayout = {
  title: string;
  left: DraftSlotRef[];
  right: DraftSlotRef[];
};

export type DraftPickRowLayout = {
  side: Side;
  slots: DraftSlotRef[];
  /** Wider team color block beside slots */
  teamBlock?: "sm" | "lg";
};

export const DRAFT_BAN_PHASE_1: DraftBanPhaseLayout = {
  title: "Ban phase 1",
  left: [{ turnIndex: 0 }, { turnIndex: 2 }, { turnIndex: 4 }],
  right: [{ turnIndex: 1 }, { turnIndex: 3 }, { turnIndex: 5 }],
};

export const DRAFT_PICK_PHASE_1: DraftPickRowLayout[] = [
  { side: "BLUE", slots: [{ turnIndex: 6 }], teamBlock: "sm" },
  { side: "RED", slots: [{ turnIndex: 7 }, { turnIndex: 8 }], teamBlock: "sm" },
  { side: "BLUE", slots: [{ turnIndex: 9 }, { turnIndex: 10 }], teamBlock: "lg" },
  { side: "RED", slots: [{ turnIndex: 11 }], teamBlock: "sm" },
];

export const DRAFT_BAN_PHASE_2: DraftBanPhaseLayout = {
  title: "Ban phase 2",
  left: [{ turnIndex: 13 }, { turnIndex: 15 }],
  right: [{ turnIndex: 12 }, { turnIndex: 14 }],
};

export const DRAFT_PICK_PHASE_2: DraftPickRowLayout[] = [
  { side: "RED", slots: [{ turnIndex: 16 }], teamBlock: "sm" },
  { side: "BLUE", slots: [{ turnIndex: 17 }, { turnIndex: 18 }], teamBlock: "lg" },
  { side: "RED", slots: [{ turnIndex: 19 }], teamBlock: "sm" },
];

export function entryAtTurn(
  entries: DraftEntry[],
  turnIndex: number,
): DraftEntry | undefined {
  return entries.find((e) => e.order === turnIndex);
}

export function slotLabelForTurn(turnIndex: number): string {
  return DRAFT_TURNS[turnIndex]?.slotLabel ?? `Turn ${turnIndex + 1}`;
}

export function parseDraftEntries(json: string): DraftEntry[] {
  try {
    const parsed = JSON.parse(json) as DraftEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e) =>
          e &&
          typeof e.champion === "string" &&
          (e.type === "PICK" || e.type === "BAN") &&
          (e.side === "BLUE" || e.side === "RED"),
      )
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export function serializeDraftEntries(entries: DraftEntry[]): string {
  return JSON.stringify(entries);
}

export function usedChampions(entries: DraftEntry[]): Set<string> {
  return new Set(entries.map((e) => e.champion));
}

export function currentTurnIndex(entries: DraftEntry[]): number {
  return entries.length;
}

export function isDraftComplete(entries: DraftEntry[]): boolean {
  return entries.length >= DRAFT_TURNS.length;
}

export function sideSummary(entries: DraftEntry[], side: Side) {
  const sideEntries = entries.filter((e) => e.side === side);
  return {
    bans: sideEntries.filter((e) => e.type === "BAN").map((e) => e.champion),
    picks: sideEntries.filter((e) => e.type === "PICK").map((e) => e.champion),
  };
}

export const LEAGUE_OPTIONS = ["CWL", "Titans", "Scrim", "Practice"] as const;
