import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  NOTE_CONTENT_MAX_CHARS,
  isValidNoteContentJson,
  parseFolderIdInput,
} from "@/lib/notes/content";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function publicError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message || fallback;
  if (msg.includes("TeamNote") || msg.includes("does not exist")) {
    return "Notes table missing. Run prisma/turso-team-notes.sql on Turso.";
  }
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

async function resolveFolderId(
  folderId: string | null | undefined,
): Promise<{ ok: true; folderId: string | null | undefined } | { ok: false; error: string }> {
  if (folderId === undefined) return { ok: true, folderId: undefined };
  if (folderId === null) return { ok: true, folderId: null };
  const folder = await prisma.teamNoteFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  });
  if (!folder) return { ok: false, error: "Folder not found" };
  return { ok: true, folderId };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const note = await prisma.teamNote.findUnique({
      where: { id },
      include: { folder: { select: { name: true } } },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: note.id,
      title: note.title,
      content: note.content,
      folderId: note.folderId,
      folderName: note.folder?.name ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[notes/:id GET]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to load note") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const existing = await prisma.teamNote.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      content?: unknown;
      folderId?: unknown;
    };

    const data: {
      title?: string;
      content?: string;
      folderId?: string | null;
    } = {};

    if (typeof body.title === "string") {
      const title = body.title.trim().slice(0, 120);
      data.title = title || "Untitled note";
    }

    if (typeof body.content === "string") {
      if (body.content.length > NOTE_CONTENT_MAX_CHARS) {
        return NextResponse.json(
          { error: "Note is too large (images too big or too many)." },
          { status: 400 },
        );
      }
      if (!isValidNoteContentJson(body.content)) {
        return NextResponse.json({ error: "Invalid note content" }, { status: 400 });
      }
      data.content = body.content;
    }

    if ("folderId" in body) {
      const parsedFolder = parseFolderIdInput(body.folderId);
      if (!parsedFolder.ok) {
        return NextResponse.json({ error: parsedFolder.error }, { status: 400 });
      }
      const folderResolved = await resolveFolderId(parsedFolder.value);
      if (!folderResolved.ok) {
        return NextResponse.json({ error: folderResolved.error }, { status: 400 });
      }
      if (folderResolved.folderId !== undefined) {
        data.folderId = folderResolved.folderId;
      }
    }

    if (!data.title && !data.content && !("folderId" in data)) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const note = await prisma.teamNote.update({
      where: { id },
      data,
      include: { folder: { select: { name: true } } },
    });

    return NextResponse.json({
      id: note.id,
      title: note.title,
      content: note.content,
      folderId: note.folderId,
      folderName: note.folder?.name ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[notes/:id PATCH]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to save note") },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.teamNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notes/:id DELETE]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to delete note") },
      { status: 500 },
    );
  }
}
