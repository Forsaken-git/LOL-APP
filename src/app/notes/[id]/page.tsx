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
  const note = await prisma.teamNote.findUnique({ where: { id } });
  if (!note) notFound();

  return (
    <NoteEditor
      initial={{
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      }}
    />
  );
}
