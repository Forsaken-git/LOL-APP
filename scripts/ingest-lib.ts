import { readFileSync, readdirSync, statSync } from "fs";
import { extname, resolve } from "path";
import {
  inferFolderContext,
  type ImportFolderContext,
} from "../src/lib/ingest/folder-context";
import {
  mergeIngestPayloads,
  normalizeIngestPayload,
} from "../src/lib/ingest/normalize";
import type { IngestPayload } from "../src/lib/ingest/types";

export type JsonFileRef = {
  path: string;
  folderContext: ImportFolderContext | null;
};

function walkJsonFiles(dir: string, out: JsonFileRef[]): void {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = resolve(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkJsonFiles(full, out);
      continue;
    }
    if (extname(name).toLowerCase() !== ".json") continue;
    out.push({
      path: full,
      folderContext: inferFolderContext(full),
    });
  }
}

export function collectJsonFiles(inputs: string[]): JsonFileRef[] {
  const files: JsonFileRef[] = [];

  for (const input of inputs) {
    const abs = resolve(input);
    let st;
    try {
      st = statSync(abs);
    } catch {
      throw new Error(`Path not found: ${input}`);
    }

    if (st.isFile()) {
      if (extname(abs).toLowerCase() !== ".json") {
        throw new Error(`Not a JSON file: ${input}`);
      }
      files.push({ path: abs, folderContext: inferFolderContext(abs) });
      continue;
    }

    if (st.isDirectory()) {
      walkJsonFiles(abs, files);
      continue;
    }

    throw new Error(`Not a file or directory: ${input}`);
  }

  const seen = new Set<string>();
  return files
    .filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function collectJsonPaths(inputs: string[]): string[] {
  return collectJsonFiles(inputs).map((f) => f.path);
}

export function loadIngestFromFiles(refs: JsonFileRef[]): IngestPayload {
  if (refs.length === 0) {
    throw new Error("No JSON files found");
  }

  const payloads = refs.map(({ path, folderContext }) => {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return normalizeIngestPayload(raw, { folderContext });
  });

  return mergeIngestPayloads(payloads);
}

export function loadIngestFromPaths(paths: string[]): IngestPayload {
  return loadIngestFromFiles(collectJsonFiles(paths));
}

export function summarizeByFolder(refs: JsonFileRef[]): string {
  const counts = new Map<string, number>();
  for (const ref of refs) {
    const label = ref.folderContext?.kind ?? "other";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, n]) => `${k}: ${n} file(s)`)
    .join(", ");
}

export async function pushToHub(
  payload: IngestPayload,
  hubUrl: string,
  apiKey: string,
): Promise<unknown> {
  const res = await fetch(`${hubUrl.replace(/\/$/, "")}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!text) {
    throw new Error(
      `Empty response (HTTP ${res.status}). Is the dev server running?`,
    );
  }

  const body = JSON.parse(text) as unknown;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return body;
}

export async function ingestLocal(payload: IngestPayload): Promise<unknown> {
  const { runIngest } = await import("../src/lib/ingest/sync");
  return runIngest(payload);
}

export function summarizePayload(payload: IngestPayload): string {
  return `${payload.players?.length ?? 0} players, ${payload.matches?.length ?? 0} matches, ${payload.events?.length ?? 0} events`;
}
