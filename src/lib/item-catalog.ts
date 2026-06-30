import { DDRAGON_VERSION } from "@/lib/champion-image-keys.generated";
import { canonicalItemId } from "@/lib/items";

export type ItemStatLine = { label: string };

export type ItemCatalogEntry = {
  id: number;
  name: string;
  plaintext: string;
  gold: number | null;
  statLines: ItemStatLine[];
};

const PERCENT_STATS = new Set([
  "FlatCritChanceMod",
  "PercentAttackSpeedMod",
  "PercentLifeStealMod",
  "PercentMovementSpeedMod",
  "PercentArmorPenetrationMod",
  "PercentMagicPenetrationMod",
  "PercentBonusPhysicalDamageMod",
  "PercentBonusMagicDamageMod",
]);

const STAT_LABELS: Record<string, string> = {
  FlatHPPoolMod: "Health",
  FlatMPPoolMod: "Mana",
  FlatPhysicalDamageMod: "Attack Damage",
  FlatMagicDamageMod: "Ability Power",
  FlatArmorMod: "Armor",
  FlatSpellBlockMod: "Magic Resist",
  FlatCritChanceMod: "Critical Strike Chance",
  FlatMovementSpeedMod: "Movement Speed",
  PercentAttackSpeedMod: "Attack Speed",
  PercentLifeStealMod: "Life Steal",
  FlatHPRegenMod: "Health Regen",
  FlatMPRegenMod: "Mana Regen",
  FlatArmorPenetrationMod: "Armor Penetration",
  PercentArmorPenetrationMod: "Armor Penetration",
  FlatMagicPenetrationMod: "Magic Penetration",
  PercentMagicPenetrationMod: "Magic Penetration",
  FlatEnergyPoolMod: "Energy",
  FlatEnergyRegenMod: "Energy Regen",
};

function formatStatValue(key: string, raw: number): string {
  if (PERCENT_STATS.has(key)) {
    const pct = Math.round(raw * 1000) / 10;
    return `+${pct}%`;
  }
  if (Number.isInteger(raw) || Math.abs(raw - Math.round(raw)) < 0.01) {
    return `+${Math.round(raw)}`;
  }
  return `+${Math.round(raw * 10) / 10}`;
}

function formatStatLines(stats: Record<string, number>): ItemStatLine[] {
  const lines: ItemStatLine[] = [];
  for (const [key, raw] of Object.entries(stats)) {
    if (typeof raw !== "number" || raw === 0) continue;
    const label = STAT_LABELS[key];
    if (!label) continue;
    lines.push({ label: `${formatStatValue(key, raw)} ${label}` });
  }
  return lines;
}

function parseDdragonItem(
  id: number,
  raw: {
    name?: string;
    plaintext?: string;
    description?: string;
    gold?: { total?: number };
    stats?: Record<string, number>;
  },
): ItemCatalogEntry {
  const statLines = formatStatLines(raw.stats ?? {});
  return {
    id,
    name: raw.name ?? `Item ${id}`,
    plaintext: raw.plaintext?.trim() ?? "",
    gold: typeof raw.gold?.total === "number" ? raw.gold.total : null,
    statLines,
  };
}

let catalogPromise: Promise<Map<number, ItemCatalogEntry>> | null = null;

export function loadItemCatalog(): Promise<Map<number, ItemCatalogEntry>> {
  if (!catalogPromise) {
    catalogPromise = fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`item.json HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const data = (json?.data ?? {}) as Record<
          string,
          {
            name?: string;
            plaintext?: string;
            description?: string;
            gold?: { total?: number };
            stats?: Record<string, number>;
          }
        >;
        const map = new Map<number, ItemCatalogEntry>();
        for (const [key, value] of Object.entries(data)) {
          const id = Number(key);
          if (!Number.isFinite(id)) continue;
          const entry = parseDdragonItem(id, value);
          map.set(id, entry);
          const canonical = canonicalItemId(id);
          if (canonical !== id && !map.has(canonical)) {
            map.set(canonical, { ...entry, id: canonical });
          }
        }
        return map;
      })
      .catch((e) => {
        catalogPromise = null;
        throw e;
      });
  }
  return catalogPromise;
}

export function getCatalogItem(
  catalog: Map<number, ItemCatalogEntry> | null,
  itemId: number,
): ItemCatalogEntry | null {
  if (!catalog) return null;
  return catalog.get(canonicalItemId(itemId)) ?? catalog.get(itemId) ?? null;
}
