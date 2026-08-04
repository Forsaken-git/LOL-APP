/** Empty TipTap/ProseMirror document. */
export const EMPTY_NOTE_CONTENT = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

/** Soft cap so Turso rows stay reasonable with embedded images. */
export const NOTE_CONTENT_MAX_CHARS = 2_000_000;

export type TeamNoteSummary = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  /** Plain-text preview from the first paragraph. */
  preview: string;
};

export type TeamNoteDetail = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  createdAt: string;
};

type JsonNode = {
  type?: string;
  text?: string;
  content?: JsonNode[];
};

function collectPreviewText(node: JsonNode, parts: string[]): void {
  if (node.type === "image") {
    parts.push("[image]");
    return;
  }
  if (typeof node.text === "string") parts.push(node.text);
  for (const child of node.content ?? []) collectPreviewText(child, parts);
}

export function notePreviewFromContent(content: string, maxLen = 120): string {
  try {
    const doc = JSON.parse(content) as JsonNode;
    const parts: string[] = [];
    collectPreviewText(doc, parts);
    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    if (!text) return "Empty note";
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  } catch {
    return "Note";
  }
}

export function isValidNoteContentJson(raw: string): boolean {
  try {
    const doc = JSON.parse(raw) as { type?: string };
    return doc?.type === "doc";
  } catch {
    return false;
  }
}
