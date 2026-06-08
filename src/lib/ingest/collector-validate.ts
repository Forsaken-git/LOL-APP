import type { IngestMatch, IngestParticipant, ParticipantBuild } from "./types";

export type CollectorFieldStatus =
  | "stored"
  | "derived"
  | "optional"
  | "eog_only";

/** What the scoreboard needs vs where it comes from. */
export const COLLECTOR_FIELD_MATRIX: {
  field: string;
  status: CollectorFieldStatus;
  note: string;
}[] = [
  { field: "displayName / summonerName", status: "stored", note: "EOG riotIdGameName" },
  { field: "champion", status: "stored", note: "DDragon display name for images" },
  { field: "build.spell1Id / spell2Id", status: "stored", note: "EOG player root" },
  { field: "build.perks", status: "stored", note: "PERK0–5 + styles in stats" },
  { field: "build.itemIds", status: "stored", note: "ITEM0–7 → max 6 core" },
  { field: "build.trinketItemId", status: "stored", note: "Pulled from ITEM slots" },
  {
    field: "build.questItemId",
    status: "stored",
    note: "ADC boots, JG pet (1101–1107), lane/support quests",
  },
  { field: "kills / deaths / assists", status: "stored", note: "EOG stats" },
  { field: "KP%", status: "derived", note: "UI: (K+A) / team kills from all 10 rows" },
  { field: "cs", status: "stored", note: "minions + neutral" },
  { field: "CS/min", status: "derived", note: "cs ÷ (gameDurationSec / 60)" },
  { field: "damage", status: "stored", note: "TOTAL_DAMAGE_DEALT_TO_CHAMPIONS" },
  { field: "goldEarned", status: "stored", note: "GOLD_EARNED" },
  { field: "gameDurationSec", status: "stored", note: "EOG gameLength" },
  { field: "visionScore", status: "optional", note: "VISION_SCORE when present" },
];

export type CollectorValidation = {
  ok: boolean;
  warnings: string[];
};

function label(p: IngestParticipant, index: number): string {
  return p.displayName?.trim() || p.summonerName?.trim() || `player#${index}`;
}

function checkBuild(
  build: ParticipantBuild | undefined,
  p: IngestParticipant,
  warnings: string[],
  who: string,
): void {
  if (!build) {
    warnings.push(`${who}: missing build (items/spells/runes)`);
    return;
  }
  if (!build.spell1Id && !build.spell2Id) {
    warnings.push(`${who}: missing summoner spells`);
  }
  if (!build.perks?.slots?.length) {
    warnings.push(`${who}: missing runes`);
  }
  const role = (p.position ?? p.teamRole ?? "").toUpperCase();
  const isAdc = role === "BOTTOM" || role === "ADC";
  const isJg = role === "JUNGLE" || role === "JG";
  if (isAdc && build.questItemId == null) {
    warnings.push(`${who}: ADC missing quest boots (questItemId)`);
  }
  if (isJg && build.questItemId == null) {
    warnings.push(`${who}: jungle missing quest pet (questItemId)`);
  }
  if (build.trinketItemId == null) {
    warnings.push(`${who}: missing trinket`);
  }
  if (!build.itemIds?.length && build.questItemId == null) {
    warnings.push(`${who}: no core items`);
  }
}

export function validateIngestMatch(match: IngestMatch): CollectorValidation {
  const warnings: string[] = [];

  if (!match.gameDurationSec || match.gameDurationSec <= 0) {
    warnings.push("match: missing gameDurationSec (CS/min needs duration)");
  }

  const parts = match.participants ?? [];
  if (parts.length < 10) {
    warnings.push(`match: only ${parts.length}/10 participants`);
  }

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const who = label(p, i);

    if (!p.displayName?.trim() && !p.summonerName?.trim()) {
      warnings.push(`${who}: missing player name`);
    }
    if (!p.champion?.trim() || p.champion === "Unknown") {
      warnings.push(`${who}: missing champion name`);
    }
    if (p.kills == null && p.deaths == null && p.assists == null) {
      warnings.push(`${who}: missing K/D/A`);
    }
    if (p.cs == null) {
      warnings.push(`${who}: missing CS`);
    }
    if (p.damage == null) {
      warnings.push(`${who}: missing damage`);
    }
    if (p.goldEarned == null) {
      warnings.push(`${who}: missing gold`);
    }
    checkBuild(p.build, p, warnings, who);
  }

  return { ok: warnings.length === 0, warnings };
}
