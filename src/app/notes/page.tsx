import { PageHeader } from "@/components/ui/PageHeader";
import { NotesView } from "@/components/notes/NotesView";
import { notePreviewFromContent } from "@/lib/notes/content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  let notes: {
    id: string;
    title: string;
    content: string;
    folderId: string | null;
    createdAt: Date;
    updatedAt: Date;
    folder: { name: string } | null;
  }[] = [];
  let folders: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { notes: number };
  }[] = [];
  let loadError: string | null = null;

  try {
    [notes, folders] = await Promise.all([
      prisma.teamNote.findMany({
        orderBy: { updatedAt: "desc" },
        include: { folder: { select: { name: true } } },
      }),
      prisma.teamNoteFolder.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { notes: true } } },
      }),
    ]);
  } catch (error) {
    console.error("[notes page]", error);
    loadError =
      "Notes table missing. Run prisma/turso-team-notes.sql (and turso-note-folders.sql) on Turso.";
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        description="Shared team notes — write freely and paste screenshots. Everyone on the hub can see and edit."
      />
      {loadError ? (
        <p className="mb-4 text-sm text-rose-300">{loadError}</p>
      ) : null}
      <NotesView
        initialNotes={notes.map((n) => ({
          id: n.id,
          title: n.title,
          folderId: n.folderId,
          folderName: n.folder?.name ?? null,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
          preview: notePreviewFromContent(n.content),
        }))}
        initialFolders={folders.map((f) => ({
          id: f.id,
          name: f.name,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
          noteCount: f._count.notes,
        }))}
      />
    </div>
  );
}
