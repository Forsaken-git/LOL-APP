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
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  let loadError: string | null = null;

  try {
    notes = await prisma.teamNote.findMany({
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("[notes page]", error);
    loadError =
      "Notes table missing. Run prisma/turso-team-notes.sql on Turso (or prisma db push locally).";
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
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
          preview: notePreviewFromContent(n.content),
        }))}
      />
    </div>
  );
}
