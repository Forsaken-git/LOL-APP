import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export const DEFAULT_HUB = "http://localhost:3000";

export function loadDotEnv(): void {
  const path = resolve(".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function localHubUrl(): string {
  loadDotEnv();
  const hubUrl = (process.env.HUB_URL ?? DEFAULT_HUB).trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(hubUrl)) return DEFAULT_HUB;
  return hubUrl;
}
