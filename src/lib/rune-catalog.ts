import { DDRAGON_VERSION } from "@/lib/champion-image-keys.generated";

export type RuneCatalogEntry = {
  id: number;
  name: string;
  description: string;
  kind: "perk" | "style";
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let catalogPromise: Promise<Map<number, RuneCatalogEntry>> | null = null;

export function loadRuneCatalog(): Promise<Map<number, RuneCatalogEntry>> {
  if (!catalogPromise) {
    catalogPromise = fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/runesReforged.json`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`runesReforged.json HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const map = new Map<number, RuneCatalogEntry>();
        if (!Array.isArray(json)) return map;

        for (const tree of json as Array<{
          id?: number;
          name?: string;
          shortDesc?: string;
          slots?: Array<{
            runes?: Array<{
              id?: number;
              name?: string;
              shortDesc?: string;
            }>;
          }>;
        }>) {
          const styleId = Number(tree.id ?? 0);
          if (Number.isFinite(styleId) && styleId > 0) {
            map.set(styleId, {
              id: styleId,
              name: tree.name?.trim() || `Style ${styleId}`,
              description: stripHtml(tree.shortDesc ?? ""),
              kind: "style",
            });
          }

          for (const slot of tree.slots ?? []) {
            for (const rune of slot.runes ?? []) {
              const id = Number(rune.id ?? 0);
              if (!Number.isFinite(id) || id <= 0) continue;
              map.set(id, {
                id,
                name: rune.name?.trim() || `Rune ${id}`,
                description: stripHtml(rune.shortDesc ?? ""),
                kind: "perk",
              });
            }
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

export function getCatalogRune(
  catalog: Map<number, RuneCatalogEntry> | null,
  runeId: number,
): RuneCatalogEntry | null {
  if (!catalog) return null;
  return catalog.get(runeId) ?? null;
}
