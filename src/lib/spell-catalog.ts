import { DDRAGON_VERSION } from "@/lib/champion-image-keys.generated";

export type SpellCatalogEntry = {
  id: number;
  name: string;
  description: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let catalogPromise: Promise<Map<number, SpellCatalogEntry>> | null = null;

export function loadSpellCatalog(): Promise<Map<number, SpellCatalogEntry>> {
  if (!catalogPromise) {
    catalogPromise = fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/summoner.json`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`summoner.json HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const data = (json?.data ?? {}) as Record<
          string,
          { key?: string; name?: string; description?: string }
        >;
        const map = new Map<number, SpellCatalogEntry>();
        for (const value of Object.values(data)) {
          const id = Number(value.key ?? 0);
          if (!Number.isFinite(id) || id <= 0) continue;
          map.set(id, {
            id,
            name: value.name?.trim() || `Spell ${id}`,
            description: stripHtml(value.description ?? ""),
          });
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

export function getCatalogSpell(
  catalog: Map<number, SpellCatalogEntry> | null,
  spellId: number,
): SpellCatalogEntry | null {
  if (!catalog) return null;
  return catalog.get(spellId) ?? null;
}
