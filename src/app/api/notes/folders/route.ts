import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeFolderName } from "@/lib/notes/content";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const rows = await prisma.teamNoteFolder.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { notes: true } } },
    });

    return NextResponse.json({
      folders: rows.map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        noteCount: f._count.notes,
      })),
    });
  } catch (error) {
    console.error("[notes/folders GET]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to load folders"), folders: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const folder = await prisma.teamNoteFolder.create({
      data: { name },
    });

    return NextResponse.json(
      {
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString(),
        noteCount: 0,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[notes/folders POST]", error);
    return NextResponse.json(
      { error: publicError(error, "Failed to create folder") },
      { status: 500 },
    );
  }
}
