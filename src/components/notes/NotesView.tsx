"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatDateTime24 } from "@/lib/datetime";
import type {
  TeamNoteFolderSummary,
  TeamNoteSummary,
} from "@/lib/notes/content";

type Filter = "all" | "unfiled" | string;

type FolderDraft =
  | { mode: "create" }
  | { mode: "rename"; folder: TeamNoteFolderSummary };

export function NotesView({
  initialNotes,
  initialFolders,
}: {
  initialNotes: TeamNoteSummary[];
  initialFolders: TeamNoteFolderSummary[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [folders, setFolders] = useState(initialFolders);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FolderDraft | null>(null);
  const [draftName, setDraftName] = useState("");
  const draftInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  useEffect(() => {
    if (!draft) return;
    draftInputRef.current?.focus();
    draftInputRef.current?.select();
  }, [draft]);

  const visibleNotes = useMemo(() => {
    if (filter === "all") return notes;
    if (filter === "unfiled") return notes.filter((n) => !n.folderId);
    return notes.filter((n) => n.folderId === filter);
  }, [notes, filter]);

  function createNote() {
    setError(null);
    const folderId =
      filter !== "all" && filter !== "unfiled" ? filter : null;
    startTransition(async () => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled note",
          folderId,
        }),
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

  function openCreateFolder() {
    setError(null);
    setDraftName("");
    setDraft({ mode: "create" });
  }

  function openRenameFolder(folder: TeamNoteFolderSummary) {
    setError(null);
    setDraftName(folder.name);
    setDraft({ mode: "rename", folder });
  }

  function cancelDraft() {
    setDraft(null);
    setDraftName("");
  }

  function submitDraft(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Folder name required");
      return;
    }
    if (!draft) return;

    setError(null);
    if (draft.mode === "create") {
      startTransition(async () => {
        const res = await fetch("/api/notes/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const body = (await res.json()) as TeamNoteFolderSummary & {
          error?: string;
        };
        if (!res.ok || !body.id) {
          setError(body.error ?? "Failed to create folder");
          return;
        }
        setFolders((prev) =>
          [...prev, body].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setFilter(body.id);
        cancelDraft();
        router.refresh();
      });
      return;
    }

    const folderId = draft.folder.id;
    startTransition(async () => {
      const res = await fetch(`/api/notes/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json()) as TeamNoteFolderSummary & {
        error?: string;
      };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Failed to rename folder");
        return;
      }
      setFolders((prev) =>
        prev
          .map((f) => (f.id === body.id ? { ...f, ...body } : f))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNotes((prev) =>
        prev.map((n) =>
          n.folderId === body.id ? { ...n, folderName: body.name } : n,
        ),
      );
      cancelDraft();
      router.refresh();
    });
  }

  function deleteFolder(folder: TeamNoteFolderSummary) {
    setError(null);
    setDraft(null);
    startTransition(async () => {
      const res = await fetch(`/api/notes/folders/${folder.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "Failed to delete folder");
        return;
      }
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setNotes((prev) =>
        prev.map((n) =>
          n.folderId === folder.id
            ? { ...n, folderId: null, folderName: null }
            : n,
        ),
      );
      if (filter === folder.id) setFilter("all");
      router.refresh();
    });
  }

  const activeFolder =
    filter !== "all" && filter !== "unfiled"
      ? folders.find((f) => f.id === filter)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FolderChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        <FolderChip
          active={filter === "unfiled"}
          onClick={() => setFilter("unfiled")}
          label="Unfiled"
        />
        {folders.map((folder) => (
          <FolderChip
            key={folder.id}
            active={filter === folder.id}
            onClick={() => setFilter(folder.id)}
            label={folder.name}
          />
        ))}
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 text-sm"
          onClick={openCreateFolder}
          disabled={pending}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </button>
      </div>

      {draft ? (
        <form
          onSubmit={(e) => void submitDraft(e)}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-inset/40 p-3"
        >
          <label className="block min-w-[12rem] flex-1 text-xs text-muted">
            {draft.mode === "create" ? "New folder name" : "Rename folder"}
            <input
              ref={draftInputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelDraft();
                }
              }}
              maxLength={80}
              placeholder="e.g. Scrim notes"
              className="mt-1 block w-full"
              disabled={pending}
            />
          </label>
          <button type="submit" className="btn-primary text-sm" disabled={pending}>
            {pending
              ? "Saving…"
              : draft.mode === "create"
                ? "Create"
                : "Save"}
          </button>
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={cancelDraft}
            disabled={pending}
          >
            Cancel
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">
            {visibleNotes.length} note
            {visibleNotes.length === 1 ? "" : "s"}
            {filter === "all"
              ? " · shared with the team"
              : filter === "unfiled"
                ? " · unfiled"
                : activeFolder
                  ? ` · ${activeFolder.name}`
                  : ""}
          </p>
          {activeFolder ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost inline-flex items-center gap-1 text-xs"
                onClick={() => openRenameFolder(activeFolder)}
                disabled={pending}
                aria-label={`Rename ${activeFolder.name}`}
              >
                <Pencil className="h-3 w-3" />
                Rename
              </button>
              <button
                type="button"
                className="btn-ghost inline-flex items-center gap-1 text-xs text-rose-300/90"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete folder “${activeFolder.name}”? Notes inside become unfiled.`,
                    )
                  ) {
                    deleteFolder(activeFolder);
                  }
                }}
                disabled={pending}
                aria-label={`Delete ${activeFolder.name}`}
              >
                <Trash2 className="h-3 w-3" />
                Delete folder
              </button>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 text-sm"
          onClick={() => void createNote()}
          disabled={pending}
        >
          <Plus className="h-3.5 w-3.5" />
          {pending ? "Working…" : "New note"}
        </button>
      </div>

      {error ? (
        <Card>
          <p className="text-sm text-rose-300">{error}</p>
        </Card>
      ) : null}

      {visibleNotes.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            {notes.length === 0
              ? "No notes yet. Create one for draft plans, opponent intel, or meeting scribbles — pictures welcome."
              : filter === "unfiled"
                ? "No unfiled notes."
                : "No notes in this folder yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visibleNotes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="block rounded-2xl border border-border bg-surface/90 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition hover:border-border-strong hover:bg-surface-elevated"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="truncate font-medium text-foreground">
                  {note.title || "Untitled note"}
                </h2>
                {filter === "all" && note.folderName ? (
                  <span className="shrink-0 rounded-md border border-border/70 bg-inset/50 px-1.5 py-0.5 text-[10px] text-muted">
                    {note.folderName}
                  </span>
                ) : null}
              </div>
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

function FolderChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-accent/45 bg-accent/15 text-foreground"
          : "border-border bg-inset/60 text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
