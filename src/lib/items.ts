/** Data Dragon CDN helpers for items and summoner spells. */

import { DDRAGON_VERSION } from "@/lib/champion-image-keys.generated";

/** Common summoner spell IDs → DDragon image file names. */
const SUMMONER_SPELL_FILES: Record<number, string> = {
  1: "SummonerBoost",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  11: "SummonerSmite",
  12: "SummonerTeleport",
  13: "SummonerMana",
  14: "SummonerDot",
  21: "SummonerBarrier",
  32: "SummonerSnowball",
};

/** Rune style ID -> Data Dragon rune tree icon path. */
const RUNE_STYLE_ICON_URLS: Record<number, string> = {
  8000: "https://raw.communitydragon.org/latest/game/assets/perks/styles/7201_precision.png",
  8100: "https://raw.communitydragon.org/latest/game/assets/perks/styles/7200_domination.png",
  8200: "https://raw.communitydragon.org/latest/game/assets/perks/styles/7202_sorcery.png",
  8300: "https://raw.communitydragon.org/latest/game/assets/perks/styles/7203_whimsy.png",
  8400: "https://raw.communitydragon.org/latest/game/assets/perks/styles/7204_resolve.png",
};

/** Keystone perk ID -> CommunityDragon icon URL. */
const KEYSTONE_ICON_URLS: Record<number, string> = {
  8005: "https://raw.communitydragon.org/latest/game/assets/perks/styles/precision/presstheattack/presstheattack.png",
  8008: "https://raw.communitydragon.org/latest/game/assets/perks/styles/precision/lethaltempo/lethaltempotemp.png",
  8010: "https://raw.communitydragon.org/latest/game/assets/perks/styles/precision/conqueror/conqueror.png",
  8021: "https://raw.communitydragon.org/latest/game/assets/perks/styles/precision/fleetfootwork/fleetfootwork.png",
  8112: "https://raw.communitydragon.org/latest/game/assets/perks/styles/domination/electrocute/electrocute.png",
  8124: "https://raw.communitydragon.org/latest/game/assets/perks/styles/domination/predator/predator.png",
  8128: "https://raw.communitydragon.org/latest/game/assets/perks/styles/domination/darkharvest/darkharvest.png",
  9923: "https://raw.communitydragon.org/latest/game/assets/perks/styles/domination/hailofblades/hailofblades.png",
  8214: "https://raw.communitydragon.org/latest/game/assets/perks/styles/sorcery/summonaery/summonaery.png",
  8229: "https://raw.communitydragon.org/latest/game/assets/perks/styles/sorcery/arcanecomet/arcanecomet.png",
  8230: "https://raw.communitydragon.org/latest/game/assets/perks/styles/sorcery/phaserush/stormraiderssurgeruneicon2.png",
  8351: "https://raw.communitydragon.org/latest/game/assets/perks/styles/inspiration/glacialaugment/glacialaugment.png",
  8360: "https://raw.communitydragon.org/latest/game/assets/perks/styles/inspiration/unsealedspellbook/unsealedspellbook.png",
  8369: "https://raw.communitydragon.org/latest/game/assets/perks/styles/inspiration/firststrike/firststrike.png",
  8437: "https://raw.communitydragon.org/latest/game/assets/perks/styles/resolve/graspoftheundying/graspoftheundying.png",
  8439: "https://raw.communitydragon.org/latest/game/assets/perks/styles/resolve/veteranaftershock/veteranaftershock.png",
  8465: "https://raw.communitydragon.org/latest/game/assets/perks/styles/resolve/guardian/guardian.png",
  // Legacy keystone still present in older/manual data.
  8992:
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/sorcery/deathfiretouch/deathfire_touch_keystone.png",
};

/** Recognized boot item IDs (base + upgrades, including newer season variants). */
const BOOT_ITEM_IDS = new Set([
  1001, 2422, 3005, 3006, 3008, 3009, 3010, 3013, 3020, 3023, 3024, 3041, 3047,
  3111, 3112, 3113, 3114, 3117, 3151, 3152, 3158, 3168, 3170, 3171, 3172, 3173,
  3174, 3175, 3176, 3177,
  // Season API remapped boot ids (2230xx mirrors 300x boots from live game data).
  223005, 223006, 223008, 223009, 223020, 223047, 223111, 223158,
]);

/** Live game remaps shop items to 220000 + classic id (e.g. 226665 → 6665 Jak'Sho). */
const LIVE_ITEM_OFFSET = 220000;

/** Live/arena item ids in the 223xxx range map to classic 300x boot ids. */
function classicBootIdFromVariant(itemId: number): number | null {
  if (itemId < 223000 || itemId >= 224000) return null;
  const classic = 3000 + (itemId - 223000);
  return BOOT_ITEM_IDS.has(classic) ? classic : null;
}

/** Map live 22xxxx ids to classic ids for icons and storage. */
function classicItemIdFromLiveVariant(itemId: number): number | null {
  if (itemId < LIVE_ITEM_OFFSET || itemId >= 230000) return null;
  const boot = classicBootIdFromVariant(itemId);
  if (boot != null) return boot;
  const classic = itemId - LIVE_ITEM_OFFSET;
  if (classic > 0 && classic < 100000) return classic;
  return null;
}

export function isBootItemId(itemId: number): boolean {
  if (BOOT_ITEM_IDS.has(itemId)) return true;
  return classicBootIdFromVariant(itemId) != null;
}

/** Vision trinkets / sweeper upgrades — keep in sync with scripts/lcu_spectate/item_slots.py */
const TRINKET_ITEM_IDS = new Set([
  1104, // Eye of the Herald (trinket slot)
  3330, // Scarecrow Effigy
  3340, // Stealth Ward
  3348, // Arcane Sweeper
  3349, // Lucent Singularity
  3363, // Farsight Alteration
  3364, // Oracle Lens
  3513, // Eye of the Herald
  6702, // Scouting Ahead
]);

export function isTrinketItemId(itemId: number): boolean {
  if (isBootItemId(itemId)) return false;
  const canonical = canonicalItemId(itemId);
  return TRINKET_ITEM_IDS.has(itemId) || TRINKET_ITEM_IDS.has(canonical);
}

export function resolveItemImageId(itemId: number): number {
  return classicBootIdFromVariant(itemId) ?? classicItemIdFromLiveVariant(itemId) ?? itemId;
}

/** Prefer classic id when ingesting live remapped ids. */
export function canonicalItemId(itemId: number): number {
  return resolveItemImageId(itemId);
}

export function normalizeItemLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019`´]/g, "'")
    .replace(/\s+/g, " ");
}

/** Lookup keys for a Data Dragon item name (short + no-apostrophe aliases). */
export function lookupKeysForItemName(name: string): string[] {
  const normalized = normalizeItemLookupKey(name);
  const keys = new Set<string>([normalized, normalized.replace(/'/g, "")]);
  const short = normalized.split(",")[0]?.trim();
  if (short) {
    keys.add(short);
    keys.add(short.replace(/'/g, ""));
  }
  return [...keys];
}

export type ItemNameLookup = Map<string, number>;

export function buildItemNameLookup(
  items: { id: number; name: string }[],
): ItemNameLookup {
  const byName: ItemNameLookup = new Map();
  const preferId = (a: number, b: number) => {
    if (a < 100000 && b >= 100000) return a;
    if (b < 100000 && a >= 100000) return b;
    return Math.min(a, b);
  };

  for (const item of items) {
    const storeId = canonicalItemId(item.id);
    for (const key of lookupKeysForItemName(item.name)) {
      const existing = byName.get(key);
      byName.set(key, existing == null ? storeId : preferId(existing, storeId));
    }
  }
  return byName;
}

export function resolveItemIdByName(
  name: string,
  lookup: ItemNameLookup | null,
): number | null {
  if (!lookup) return null;
  const normalized = normalizeItemLookupKey(name);
  return (
    lookup.get(normalized) ??
    lookup.get(normalized.replace(/'/g, "")) ??
    null
  );
}

/**
 * Parse a single item field (manual entry / datalist).
 * Resolves the full string first so names like "Jak'Sho, The Protean" are not
 * split on the comma. Use `;` or newline to enter multiple items in one field.
 */
export function parseItemInput(
  raw: string,
  lookup: ItemNameLookup | null,
): { ids: number[]; unknown: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) return { ids: [], unknown: [] };

  const fullId = resolveItemIdByName(trimmed, lookup);
  if (fullId != null) return { ids: [fullId], unknown: [] };

  if (/^\d+$/.test(trimmed)) return { ids: [Number(trimmed)], unknown: [] };

  const parts = trimmed
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const ids: number[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      ids.push(Number(part));
      continue;
    }
    const id = resolveItemIdByName(part, lookup);
    if (id != null) ids.push(id);
    else unknown.push(part);
  }
  return { ids, unknown };
}

export function itemImageUrl(itemId: number): string {
  const imageId = resolveItemImageId(itemId);
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${imageId}.png`;
}

export function summonerSpellImageUrl(spellId: number): string | null {
  const file = SUMMONER_SPELL_FILES[spellId];
  if (!file) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${file}.png`;
}

export function runeStyleIconUrl(styleId: number): string | null {
  return RUNE_STYLE_ICON_URLS[styleId] ?? null;
}

export function keystoneIconUrl(perkId: number): string | null {
  return KEYSTONE_ICON_URLS[perkId] ?? null;
}

export function parseBuildJson(raw: string | null | undefined): {
  itemIds: number[];
  questItemId?: number;
  trinketItemId?: number;
  spell1Id?: number;
  spell2Id?: number;
  perks?: {
    primaryStyle?: number;
    subStyle?: number;
    slots: number[];
  };
} | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      itemIds?: number[];
      questItemId?: number;
      trinketItemId?: number;
      spell1Id?: number;
      spell2Id?: number;
      perks?: {
        primaryStyle?: number;
        subStyle?: number;
        slots?: number[];
      };
    };
    if (!data || typeof data !== "object") return null;
    const itemIds = Array.isArray(data.itemIds)
      ? data.itemIds.filter((id) => typeof id === "number" && id > 0)
      : [];
    const questItemId =
      typeof data.questItemId === "number" && data.questItemId > 0
        ? data.questItemId
        : undefined;
    const trinketItemId =
      typeof data.trinketItemId === "number" && data.trinketItemId > 0
        ? data.trinketItemId
        : undefined;
    const hasSpells =
      typeof data.spell1Id === "number" || typeof data.spell2Id === "number";
    const hasPerks = !!data.perks;
    if (
      itemIds.length === 0 &&
      questItemId == null &&
      trinketItemId == null &&
      !hasSpells &&
      !hasPerks
    ) {
      return null;
    }
    return {
      itemIds,
      ...(questItemId != null ? { questItemId } : {}),
      ...(trinketItemId != null ? { trinketItemId } : {}),
      spell1Id: data.spell1Id,
      spell2Id: data.spell2Id,
      perks: data.perks
        ? {
            primaryStyle: data.perks.primaryStyle,
            subStyle: data.perks.subStyle,
            slots: Array.isArray(data.perks.slots)
              ? data.perks.slots.filter((id) => typeof id === "number" && id > 0)
              : [],
          }
        : undefined,
    };
  } catch {
    return null;
  }
}
