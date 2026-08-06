import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeFolderName } from "@/lib/notes/content";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function publicError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message || fallback;
  if (
    msg.includes("TeamNoteFolder") ||
    msg.includes("TeamNote") ||
    msg.includes("does not exist")
  ) {
    return "Notes folders table missing. Run prisma/turso-note-folders.sql on Turso.";
  }
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const existing = await prisma.teamNoteFolder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };

    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    }
    const name = normalizeFolderName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    }

    const folder = await prisma.teamNoteFolder.update({
      where: { id },
      data: { name },
      include: { _count: { select: { notes: true } } },
    });

    return NextResponse.json({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      noteCount: folder._count.notes,
    });
  } catch (error) {
    console.error("[notes/folders/:id PATCH]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to rename folder") },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const existing = await prisma.teamNoteFolder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Clear folderId on notes first (SQLite may not enforce FK onDelete).
    await prisma.teamNote.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });
    await prisma.teamNoteFolder.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notes/folders/:id DELETE]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to delete folder") },
      { status: 500 },
    );
  }
}
