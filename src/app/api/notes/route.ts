import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_NOTE_CONTENT,
  NOTE_CONTENT_MAX_CHARS,
  isValidNoteContentJson,
  notePreviewFromContent,
} from "@/lib/notes/content";

export const dynamic = "force-dynamic";

function publicError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message || fallback;
  if (msg.includes("TeamNote") || msg.includes("does not exist")) {
    return "Notes table missing. Run prisma/turso-team-notes.sql on Turso.";
  }
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

export async function GET() {
  try {
    const rows = await prisma.teamNote.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      notes: rows.map((n) => ({
        id: n.id,
        title: n.title,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        preview: notePreviewFromContent(n.content),
      })),
    });
  } catch (error) {
    console.error("[notes GET]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to load notes"), notes: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      content?: unknown;
    };

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : "Untitled note";

    let content = EMPTY_NOTE_CONTENT;
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
      content = body.content;
    }

    const note = await prisma.teamNote.create({
      data: { title, content },
    });

    return NextResponse.json(
      {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[notes POST]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to create note") },
      { status: 500 },
    );
  }
}
