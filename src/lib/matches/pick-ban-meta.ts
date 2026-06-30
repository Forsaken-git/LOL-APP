import type { PickBanType, Side } from "@prisma/client";

export type PickBanRow = {
  id?: string;
  champion: string;
  type: PickBanType;
  side: Side;
  order: number;
};

export type PickBanCaptureKind =
  | "none"
  | "lcu_full"
  | "lcu_partial"
  | "lcu_picks_only"
  | "imported"
  | "inferred";

export type PickBanCaptureInfo = {
  kind: PickBanCaptureKind;
  label: string;
  detail: string;
  banCount: number;
  pickCount: number;
  fromLcu: boolean;
};

export function describePickBanCapture(
  source: string | null | undefined,
  pickBans: PickBanRow[],
): PickBanCaptureInfo {
  const banCount = pickBans.filter((p) => p.type === "BAN").length;
  const pickCount = pickBans.filter((p) => p.type === "PICK").length;
  const fromLcu = (source ?? "").toLowerCase().includes("lcu");

  if (pickBans.length === 0) {
    return {
      kind: "none",
      label: "No draft data",
      detail: "No pick/ban rows stored for this match.",
      banCount,
      pickCount,
      fromLcu,
    };
  }

  if (fromLcu && banCount >= 10) {
    return {
      kind: "lcu_full",
      label: "LCU captured",
      detail: "Full champ-select draft recorded by the LCU spectate collector.",
      banCount,
      pickCount,
      fromLcu,
    };
  }

  if (fromLcu && banCount > 0) {
    return {
      kind: "lcu_partial",
      label: "LCU partial",
      detail: `${banCount} ban(s) and ${pickCount} pick(s) from LCU — draft may be incomplete.`,
      banCount,
      pickCount,
      fromLcu,
    };
  }

  if (fromLcu && banCount === 0 && pickCount > 0) {
    return {
      kind: "lcu_picks_only",
      label: "LCU — picks only",
      detail:
        "Champ select was not captured; only played champions are stored as picks.",
      banCount,
      pickCount,
      fromLcu,
    };
  }

  if (banCount > 0) {
    return {
      kind: "imported",
      label: "Imported draft",
      detail: `Pick/ban data from match import (${source ?? "unknown source"}).`,
      banCount,
      pickCount,
      fromLcu,
    };
  }

  return {
    kind: "inferred",
    label: "Inferred picks",
    detail:
      "Only our played champions are stored as picks (no ban data).",
    banCount,
    pickCount,
    fromLcu,
  };
}

export function slotsForSide(
  pickBans: PickBanRow[],
  side: Side,
  type: PickBanType,
  maxSlots: number,
): Array<PickBanRow | null> {
  const rows = pickBans
    .filter((p) => p.side === side && p.type === type)
    .sort((a, b) => a.order - b.order);
  const slots: Array<PickBanRow | null> = [];
  for (let i = 0; i < maxSlots; i++) {
    slots.push(rows[i] ?? null);
  }
  return slots;
}
