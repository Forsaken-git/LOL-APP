import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export const DEFAULT_HUB = "https://lol-app-production.up.railway.app";

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

export function resolveHubEnv(): { hubUrl: string; apiKey: string } {
  loadDotEnv();

  let hubUrl = (process.env.HUB_URL ?? DEFAULT_HUB).trim().replace(/\/$/, "");
  const apiKey = process.env.INGEST_API_KEY ?? "";

  if (!/^https?:\/\//i.test(hubUrl)) {
    console.warn(
      `HUB_URL="${hubUrl}" is not a web address — using ${DEFAULT_HUB}`,
    );
    hubUrl = DEFAULT_HUB;
  }

  if (!apiKey) {
    throw new Error(
      "Missing INGEST_API_KEY. Add it to .env or run:\n" +
        '  $env:INGEST_API_KEY="your-key"; npm run sync:remote',
    );
  }

  return { hubUrl, apiKey };
}
