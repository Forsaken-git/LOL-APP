/**
 * Generates src/lib/draft-positions.generated.ts from the LoL Wiki
 * Module:ChampionData/data (same source as List of champions by draft position).
 *
 *   node scripts/generate-draft-positions.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const championsSource = readFileSync(
  join(root, "src/lib/champions.ts"),
  "utf8",
);
const championsMatch = championsSource.match(
  /export const CHAMPIONS = \[([\s\S]*?)\] as const/,
);
if (!championsMatch) throw new Error("Could not parse CHAMPIONS from champions.ts");
const CHAMPIONS = [...championsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const WIKI_DATA_URL =
  "https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data?action=raw";

const LANE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

const WIKI_TO_LANE = {
  Top: "TOP",
  Jungle: "JUNGLE",
  Middle: "MID",
  Bottom: "ADC",
  Support: "SUPPORT",
};

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/['.\s&]/g, "")
    .replace(/^nunuwillump$/, "nunu")
    .replace(/^monkeyking$/, "wukong")
    .replace(/^renataglasc$/, "renataglasc")
    .replace(/^drmundo$/, "drmundo")
    .replace(/^leblanc$/, "leblanc")
    .replace(/^belveth$/, "belveth")
    .replace(/^kaisa$/, "kaisa")
    .replace(/^khazix$/, "khazix")
    .replace(/^chogath$/, "chogath")
    .replace(/^velkoz$/, "velkoz")
    .replace(/^reksai$/, "reksai");
}

function parsePositionList(raw) {
  if (!raw) return [];
  const lanes = [];
  for (const token of raw.match(/"([^"]+)"/g) ?? []) {
    const wiki = token.slice(1, -1);
    const lane = WIKI_TO_LANE[wiki];
    if (lane && !lanes.includes(lane)) lanes.push(lane);
  }
  for (const token of raw.match(/\b(Top|Jungle|Middle|Bottom|Support)\b/g) ?? []) {
    const lane = WIKI_TO_LANE[token];
    if (lane && !lanes.includes(lane)) lanes.push(lane);
  }
  return lanes;
}

function mergeLanes(client, external) {
  const merged = [];
  for (const lane of [...client, ...external]) {
    if (!merged.includes(lane)) merged.push(lane);
  }
  return merged.sort(
    (a, b) => LANE_ORDER.indexOf(a) - LANE_ORDER.indexOf(b),
  );
}

function parseWikiChampions(text) {
  const byNorm = new Map();
  const blocks = text.split(/\n  \["/);
  for (const block of blocks) {
    const nameMatch = block.match(/^([^"]+)"\]\s*=\s*\{/);
    if (!nameMatch) continue;
    const wikiName = nameMatch[1];
    const clientMatch = block.match(
      /\["client_positions"\]\s*=\s*\{([^}]*)\}/,
    );
    const externalMatch = block.match(
      /\["external_positions"\]\s*=\s*\{([^}]*)\}/,
    );
    const client = parsePositionList(clientMatch?.[1]);
    const external = parsePositionList(externalMatch?.[1]);
    const lanes = mergeLanes(client, external);
    byNorm.set(normalizeName(wikiName), { wikiName, lanes });
  }
  return byNorm;
}

function primaryLane(lanes) {
  if (!lanes.length) return null;
  return [...lanes].sort(
    (a, b) => LANE_ORDER.indexOf(a) - LANE_ORDER.indexOf(b),
  )[0];
}

const outPath = join(root, "src/lib/draft-positions.generated.ts");

const res = await fetch(WIKI_DATA_URL);
if (!res.ok) {
  throw new Error(`Wiki fetch failed: HTTP ${res.status}`);
}
const wikiByNorm = parseWikiChampions(await res.text());

const positionsByChampion = {};
const primaryByChampion = {};
const unmatched = [];

for (const champion of CHAMPIONS) {
  const norm = normalizeName(champion);
  const wiki = wikiByNorm.get(norm);
  if (!wiki) {
    unmatched.push(champion);
    positionsByChampion[champion] = [];
    primaryByChampion[champion] = null;
    continue;
  }
  positionsByChampion[champion] = wiki.lanes;
  primaryByChampion[champion] = primaryLane(wiki.lanes);
}

const body = `/** Auto-generated — run \`node scripts/generate-draft-positions.mjs\` after roster/wiki updates. */
/** Source: https://leagueoflegends.fandom.com/wiki/List_of_champions_by_draft_position */

export type DraftLane = ${LANE_ORDER.map((l) => `"${l}"`).join(" | ")};

export const DRAFT_LANE_ORDER: readonly DraftLane[] = ${JSON.stringify(LANE_ORDER)};

export const DRAFT_POSITIONS_BY_CHAMPION: Record<string, readonly DraftLane[]> = ${JSON.stringify(positionsByChampion, null, 2)};

export const PRIMARY_DRAFT_POSITION: Record<string, DraftLane | null> = ${JSON.stringify(primaryByChampion, null, 2)};
`;

writeFileSync(outPath, body, "utf8");
console.log(`Wrote ${outPath}`);
if (unmatched.length) {
  console.warn(`No wiki match for ${unmatched.length} champion(s):`, unmatched.join(", "));
}
