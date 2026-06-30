import { DRAFT_TURNS, type DraftEntry } from "@/lib/draft";
import type { PrepExtraBanSlot } from "@/lib/draft-prep/storage";
import { newExtraBanSlotId } from "@/lib/draft-prep/storage";
import { PREP_SLOTS_PER_SIDE } from "@/lib/draft-prep/scenario-layout";
import type { Side } from "@prisma/client";

export function upsertPrepSlotEntry(
  pickBans: DraftEntry[],
  turnIndex: number,
  champion: string,
): DraftEntry[] {
  const turn = DRAFT_TURNS[turnIndex];
  if (!turn) return pickBans;

  const filtered = pickBans.filter((e) => e.order !== turnIndex);
  const entry: DraftEntry = {
    champion,
    type: turn.type,
    side: turn.side,
    order: turnIndex,
  };
  return [...filtered, entry].sort((a, b) => a.order - b.order);
}

export function removePrepSlotEntry(
  pickBans: DraftEntry[],
  turnIndex: number,
): DraftEntry[] {
  return pickBans.filter((e) => e.order !== turnIndex);
}

export function addPrepExtraBanSlot(
  slots: PrepExtraBanSlot[],
  turnIndex: number,
  side: Side,
  label: string,
): PrepExtraBanSlot[] {
  const extrasOnSide = slots.filter(
    (slot) => slot.turnIndex === turnIndex && slot.side === side,
  ).length;
  if (extrasOnSide >= PREP_SLOTS_PER_SIDE - 1) return slots;

  return [
    ...slots,
    {
      id: newExtraBanSlotId(),
      turnIndex,
      side,
      label,
      champion: null,
    },
  ];
}

export function upsertPrepExtraBanSlot(
  slots: PrepExtraBanSlot[],
  extraId: string,
  champion: string,
): PrepExtraBanSlot[] {
  return slots.map((slot) =>
    slot.id === extraId ? { ...slot, champion } : slot,
  );
}

export function removePrepExtraBanSlot(
  slots: PrepExtraBanSlot[],
  extraId: string,
): PrepExtraBanSlot[] {
  return slots.filter((slot) => slot.id !== extraId);
}

/** Remove the primary ban slot by promoting the adjacent extra (blue: last, red: first). */
export function removePrimaryBanSlot(
  pickBans: DraftEntry[],
  extraBanSlots: PrepExtraBanSlot[],
  turnIndex: number,
  side: Side,
): { pickBans: DraftEntry[]; extraBanSlots: PrepExtraBanSlot[] } {
  const sideExtras = extraBanSlots.filter(
    (slot) => slot.turnIndex === turnIndex && slot.side === side,
  );
  if (sideExtras.length === 0) {
    return { pickBans, extraBanSlots };
  }

  const promoted =
    side === "BLUE"
      ? sideExtras[sideExtras.length - 1]
      : sideExtras[0];

  const nextPickBans = promoted.champion
    ? upsertPrepSlotEntry(pickBans, turnIndex, promoted.champion)
    : removePrepSlotEntry(pickBans, turnIndex);

  return {
    pickBans: nextPickBans,
    extraBanSlots: extraBanSlots.filter((slot) => slot.id !== promoted.id),
  };
}
