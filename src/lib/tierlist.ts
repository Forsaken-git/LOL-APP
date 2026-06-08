export type TierDef = { id: string; label: string };

export type TierlistData = {
  tiers: TierDef[];
  rows: Record<string, string[]>;
};

const DEFAULT_TIER_DEFS: TierDef[] = [
  { id: "s", label: "S" },
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
  { id: "d", label: "D" },
];

const LEGACY_KEYS = ["S", "A", "B", "C", "D"] as const;

export const TIER_ROW_STYLES = [
  {
    label: "bg-emerald-500/20 text-emerald-300",
    bar: "border-emerald-500/20 bg-emerald-500/[0.04]",
    drop: "ring-emerald-400/50",
    dot: "bg-emerald-400",
  },
  {
    label: "bg-sky-500/20 text-sky-300",
    bar: "border-sky-500/20 bg-sky-500/[0.04]",
    drop: "ring-sky-400/50",
    dot: "bg-sky-400",
  },
  {
    label: "bg-violet-500/20 text-violet-300",
    bar: "border-violet-500/20 bg-violet-500/[0.04]",
    drop: "ring-violet-400/50",
    dot: "bg-violet-400",
  },
  {
    label: "bg-amber-500/20 text-amber-300",
    bar: "border-amber-500/20 bg-amber-500/[0.04]",
    drop: "ring-amber-400/50",
    dot: "bg-amber-400",
  },
  {
    label: "bg-rose-500/20 text-rose-300",
    bar: "border-rose-500/20 bg-rose-500/[0.04]",
    drop: "ring-rose-400/50",
    dot: "bg-rose-400",
  },
  {
    label: "bg-cyan-500/16 text-cyan-300",
    bar: "border-cyan-500/18 bg-cyan-500/[0.035]",
    drop: "ring-cyan-400/45",
    dot: "bg-cyan-400",
  },
  {
    label: "bg-indigo-500/16 text-indigo-300",
    bar: "border-indigo-500/18 bg-indigo-500/[0.035]",
    drop: "ring-indigo-400/45",
    dot: "bg-indigo-400",
  },
  {
    label: "bg-fuchsia-500/16 text-fuchsia-300",
    bar: "border-fuchsia-500/18 bg-fuchsia-500/[0.035]",
    drop: "ring-fuchsia-400/45",
    dot: "bg-fuchsia-400",
  },
  {
    label: "bg-orange-500/16 text-orange-300",
    bar: "border-orange-500/18 bg-orange-500/[0.035]",
    drop: "ring-orange-400/45",
    dot: "bg-orange-400",
  },
  {
    label: "bg-slate-500/16 text-slate-300",
    bar: "border-slate-500/20 bg-slate-500/[0.03]",
    drop: "ring-slate-300/45",
    dot: "bg-slate-300",
  },
] as const;

export function tierRowStyle(index: number) {
  return TIER_ROW_STYLES[index % TIER_ROW_STYLES.length];
}

export function emptyTierlistData(): TierlistData {
  return {
    tiers: DEFAULT_TIER_DEFS.map((t) => ({ ...t })),
    rows: Object.fromEntries(DEFAULT_TIER_DEFS.map((t) => [t.id, []])),
  };
}

function isLegacyRows(parsed: unknown): parsed is Record<string, string[]> {
  if (!parsed || typeof parsed !== "object") return false;
  const o = parsed as Record<string, unknown>;
  return LEGACY_KEYS.some((k) => k in o) && !("tiers" in o);
}

export function parseTierlistRows(raw: string): TierlistData {
  const parsed: unknown = JSON.parse(raw);

  if (
    parsed &&
    typeof parsed === "object" &&
    "tiers" in parsed &&
    "rows" in parsed
  ) {
    const data = parsed as TierlistData;
    const tiers = Array.isArray(data.tiers)
      ? data.tiers
          .filter((t) => t && typeof t.id === "string")
          .map((t) => ({
            id: t.id,
            label: String(t.label ?? t.id).trim() || t.id,
          }))
      : [];
    const rows =
      data.rows && typeof data.rows === "object" ? { ...data.rows } : {};
    if (tiers.length === 0) return emptyTierlistData();
    for (const t of tiers) {
      if (!Array.isArray(rows[t.id])) rows[t.id] = [];
    }
    return { tiers, rows };
  }

  if (isLegacyRows(parsed)) {
    const tiers: TierDef[] = LEGACY_KEYS.map((k) => ({
      id: k.toLowerCase(),
      label: k,
    }));
    const rows: Record<string, string[]> = {};
    for (const k of LEGACY_KEYS) {
      rows[k.toLowerCase()] = Array.isArray(parsed[k]) ? [...parsed[k]] : [];
    }
    return { tiers, rows };
  }

  return emptyTierlistData();
}

export function tierlistDataEqual(a: TierlistData, b: TierlistData): boolean {
  if (a.tiers.length !== b.tiers.length) return false;
  for (let i = 0; i < a.tiers.length; i++) {
    if (a.tiers[i].id !== b.tiers[i].id) return false;
    if (a.tiers[i].label !== b.tiers[i].label) return false;
    const left = a.rows[a.tiers[i].id] ?? [];
    const right = b.rows[b.tiers[i].id] ?? [];
    if (left.length !== right.length) return false;
    if (!left.every((c, j) => c === right[j])) return false;
  }
  return true;
}

export function findTierId(
  data: TierlistData,
  champion: string,
): string | null {
  for (const t of data.tiers) {
    if ((data.rows[t.id] ?? []).includes(champion)) return t.id;
  }
  return null;
}

export function allPlacedChampions(data: TierlistData): Set<string> {
  return new Set(data.tiers.flatMap((t) => data.rows[t.id] ?? []));
}
