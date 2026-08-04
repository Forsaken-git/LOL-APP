import { LOL_REGIONS, type PlayerRegion } from "@/lib/player-accounts-shared";
import type { ScoutingReport } from "@/lib/scouting/types";

const STORAGE_KEY = "lol-app:scouting:v1";

export type ScoutingSession = {
  input: string;
  region: PlayerRegion;
  report: ScoutingReport | null;
};

function isPlayerRegion(value: unknown): value is PlayerRegion {
  return typeof value === "string" && (LOL_REGIONS as string[]).includes(value);
}

function isReport(value: unknown): value is ScoutingReport {
  if (!value || typeof value !== "object") return false;
  const r = value as ScoutingReport;
  return (
    isPlayerRegion(r.region) &&
    typeof r.fetchedAt === "string" &&
    typeof r.hasApiKey === "boolean" &&
    typeof r.sampleSize === "number" &&
    Array.isArray(r.players) &&
    Array.isArray(r.warnings)
  );
}

export function loadScoutingSession(): ScoutingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScoutingSession>;
    const region = isPlayerRegion(parsed.region) ? parsed.region : "WEST";
    const input = typeof parsed.input === "string" ? parsed.input : "";
    const report =
      parsed.report === null
        ? null
        : isReport(parsed.report)
          ? parsed.report
          : null;
    if (!input && !report) return null;
    return { input, region, report };
  } catch {
    return null;
  }
}

export function saveScoutingSession(session: ScoutingSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota / private mode — ignore; scout still works in-session.
  }
}

export function clearScoutingSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
