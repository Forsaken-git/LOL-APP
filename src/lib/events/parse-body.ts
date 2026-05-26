import { EventType } from "@prisma/client";

const EVENT_TYPES = new Set<string>(Object.values(EventType));

export type ParsedEventBody = {
  title: string;
  type: EventType;
  startAt: Date;
  endAt: Date | null;
  description: string | null;
  location: string | null;
};

export function parseEventBody(
  body: Record<string, unknown>,
): { ok: true; data: ParsedEventBody } | { ok: false; error: string } {
  const { title, type, startAt, endAt, description, location } = body;

  if (!title || typeof title !== "string") {
    return { ok: false, error: "title is required" };
  }
  if (!type || typeof type !== "string") {
    return { ok: false, error: "type is required" };
  }
  if (!startAt || typeof startAt !== "string") {
    return { ok: false, error: "startAt is required" };
  }
  if (!EVENT_TYPES.has(type)) {
    return {
      ok: false,
      error: `Invalid event type "${type}". Restart the dev server after schema changes.`,
    };
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Invalid startAt date" };
  }

  let parsedEnd: Date | null = null;
  if (endAt != null && endAt !== "") {
    if (typeof endAt !== "string") {
      return { ok: false, error: "Invalid endAt" };
    }
    parsedEnd = new Date(endAt);
    if (Number.isNaN(parsedEnd.getTime())) {
      return { ok: false, error: "Invalid endAt date" };
    }
  }

  return {
    ok: true,
    data: {
      title: title.trim(),
      type: type as EventType,
      startAt: start,
      endAt: parsedEnd,
      description: typeof description === "string" ? description : null,
      location: typeof location === "string" ? location : null,
    },
  };
}
