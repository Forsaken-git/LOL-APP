import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [note, folders] = await Promise.all([
    prisma.teamNote.findUnique({
      where: { id },
      include: { folder: { select: { name: true } } },
    }),
    prisma.teamNoteFolder.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  if (!note) notFound();

  return (
    <NoteEditor
      initial={{
        id: note.id,
        title: note.title,
        content: note.content,
        folderId: note.folderId,
        folderName: note.folder?.name ?? null,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      }}
      folders={folders.map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      }))}
    />
  );
}
