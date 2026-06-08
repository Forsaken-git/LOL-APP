/**
 * Regenerates src/lib/champion-image-keys.generated.ts from Data Dragon champion.json.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const versionsRes = await fetch(
  "https://ddragon.leagueoflegends.com/api/versions.json",
);
const [version] = await versionsRes.json();
const res = await fetch(
  `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
);
const { data } = await res.json();

const map = {};
for (const key of Object.keys(data)) {
  const c = data[key];
  map[c.name] = c.id;
  map[c.id] = c.id;
  map[c.key] = c.id;
  map[`Champion${c.key}`] = c.id;
}
map["Nunu"] = "Nunu";
map["Nunu & Willump"] = "Nunu";
map["LeBlanc"] = "Leblanc";

const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
const body = entries
  .map(([name, id]) => `  ${JSON.stringify(name)}: ${JSON.stringify(id)},`)
  .join("\n");

const out = `/** Auto-generated — run \`npm run ddragon:champions\` to refresh after a LoL patch. */
export const DDRAGON_VERSION = ${JSON.stringify(version)} as const;

/** Display name or internal id -> Data Dragon champion image key */
export const CHAMPION_IMAGE_KEYS: Record<string, string> = {
${body}
};
`;

const target = join(root, "src/lib/champion-image-keys.generated.ts");
writeFileSync(target, out, "utf8");
console.log(`Wrote ${target} (${entries.length} entries, patch ${version})`);
