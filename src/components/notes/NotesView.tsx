"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatDateTime24 } from "@/lib/datetime";
import type { TeamNoteSummary } from "@/lib/notes/content";

export function NotesView({ initialNotes }: { initialNotes: TeamNoteSummary[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  function createNote() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled note" }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Failed to create note");
        return;
      }
      router.push(`/notes/${body.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {notes.length} note{notes.length === 1 ? "" : "s"} · shared with the team
        </p>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 text-sm"
          onClick={() => void createNote()}
          disabled={pending}
        >
          <Plus className="h-3.5 w-3.5" />
          {pending ? "Creating…" : "New note"}
        </button>
      </div>

      {error ? (
        <Card>
          <p className="text-sm text-rose-300">{error}</p>
        </Card>
      ) : null}

      {notes.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No notes yet. Create one for draft plans, opponent intel, or meeting
            scribbles — pictures welcome.
          </p>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="block rounded-2xl border border-border bg-surface/90 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition hover:border-border-strong hover:bg-surface-elevated"
            >
              <h2 className="truncate font-medium text-foreground">
                {note.title || "Untitled note"}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                {note.preview}
              </p>
              <p className="mt-3 text-[11px] text-faint">
                Updated {formatDateTime24(new Date(note.updatedAt))}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
