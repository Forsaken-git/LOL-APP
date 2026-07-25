/** Display rows for a prep scenario card (blue left, red right). */
export type ScenarioSlot = {
  label: string;
  turnIndex: number;
};

export type ScenarioRow = {
  kind: "ban" | "pick";
  blue: ScenarioSlot;
  red: ScenarioSlot;
};

export const SCENARIO_ROWS: ScenarioRow[] = [
  { kind: "ban", blue: { label: "BB1", turnIndex: 0 }, red: { label: "RB1", turnIndex: 1 } },
  { kind: "ban", blue: { label: "BB2", turnIndex: 2 }, red: { label: "RB2", turnIndex: 3 } },
  { kind: "ban", blue: { label: "BB3", turnIndex: 4 }, red: { label: "RB3", turnIndex: 5 } },
  { kind: "pick", blue: { label: "B1", turnIndex: 6 }, red: { label: "R1", turnIndex: 7 } },
  { kind: "pick", blue: { label: "B2", turnIndex: 9 }, red: { label: "R2", turnIndex: 8 } },
  { kind: "pick", blue: { label: "B3", turnIndex: 10 }, red: { label: "R3", turnIndex: 11 } },
  { kind: "ban", blue: { label: "BB4", turnIndex: 13 }, red: { label: "RB4", turnIndex: 12 } },
  { kind: "ban", blue: { label: "BB5", turnIndex: 15 }, red: { label: "RB5", turnIndex: 14 } },
  { kind: "pick", blue: { label: "B4", turnIndex: 17 }, red: { label: "R4", turnIndex: 16 } },
  { kind: "pick", blue: { label: "B5", turnIndex: 18 }, red: { label: "R5", turnIndex: 19 } },
];

/** Max champion squares per side on a draft row (primary + extras). */
export const PREP_SLOTS_PER_SIDE = 5;

/** @deprecated Use {@link PREP_SLOTS_PER_SIDE}. */
export const PREP_BAN_SLOTS_PER_SIDE = PREP_SLOTS_PER_SIDE;

/** Pixel size of each draft slot (matches Tailwind `size-9`). */
export const PREP_SLOT_PX = 36;

/** @deprecated Use {@link PREP_SLOT_PX}. */
export const PREP_BAN_SLOT_PX = PREP_SLOT_PX;

/** Gap between draft slots in px (matches Tailwind `gap-1`). */
export const PREP_SLOT_GAP_PX = 4;

/** @deprecated Use {@link PREP_SLOT_GAP_PX}. */
export const PREP_BAN_SLOT_GAP_PX = PREP_SLOT_GAP_PX;

/** Width needed for a full side of champion slots. */
export const PREP_SIDE_WIDTH_PX =
  PREP_SLOTS_PER_SIDE * PREP_SLOT_PX +
  (PREP_SLOTS_PER_SIDE - 1) * PREP_SLOT_GAP_PX;

/** Vertical padding inside each draft row (matches Tailwind `py-1`). */
export const PREP_ROW_PAD_Y_PX = 8;

/** Gap between draft rows (matches Tailwind `gap-[2px]`). */
export const PREP_ROW_GAP_PX = 2;

/** Minimum row height so champion slots are never vertically clipped. */
export const PREP_ROW_MIN_HEIGHT_PX = PREP_SLOT_PX + PREP_ROW_PAD_Y_PX;

/**
 * Cell size must fit: CellZoomLayer padding + card padding + row padding +
 * divider + column gap + both sides at full slot capacity.
 */
export const PREP_CELL_WIDTH =
  16 + // CellZoomLayer p-2
  16 + // ScenarioCard p-2
  16 + // row px-2
  4 + // divider w-1
  8 + // grid gap-2
  PREP_SIDE_WIDTH_PX * 2 +
  8; // breathing room

/**
 * Cell height must fit header, notes footer, and every draft row at slot height.
 */
export const PREP_CELL_HEIGHT =
  16 + // CellZoomLayer p-2
  16 + // ScenarioCard p-2
  40 + // header
  SCENARIO_ROWS.length * PREP_ROW_MIN_HEIGHT_PX +
  (SCENARIO_ROWS.length - 1) * PREP_ROW_GAP_PX +
  48 + // notes footer
  16; // breathing room

export const PREP_GRID_COLS = 12;
export const PREP_GRID_ROWS = 8;

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}
