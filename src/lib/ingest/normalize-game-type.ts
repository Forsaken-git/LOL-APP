import type { GameType } from "@prisma/client";

const GAME_TYPES = new Set<GameType>(["OFFICIAL", "TRAINING", "SCRIM"]);

/** Map ingest / collector strings to a valid Prisma GameType. */
export function normalizeGameType(value: unknown, league?: string): GameType {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (GAME_TYPES.has(raw as GameType)) return raw as GameType;

  const text = `${raw} ${league ?? ""}`.toLowerCase();
  if (text.includes("scrim") || text.includes("practice")) return "SCRIM";
  if (text.includes("train")) return "TRAINING";
  // CWL, Titans League, etc. are official competitions — not a separate GameType.
  return "OFFICIAL";
}
