"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Trash2,
} from "lucide-react";
import { formatDateTime24 } from "@/lib/datetime";
import {
  NOTE_CONTENT_MAX_CHARS,
  type TeamNoteDetail,
} from "@/lib/notes/content";
import { compressImageToDataUrl, isImageFile } from "@/lib/notes/images";
import { NoteImage, nextImagePlacement } from "@/components/notes/NoteImage";

type Props = {
  initial: TeamNoteDetail;
};

export function NoteEditor({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  const contentRef = useRef(initial.content);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const persist = useCallback(
    async (next: { title?: string; content?: string }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/notes/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const body = (await res.json()) as TeamNoteDetail & { error?: string };
        if (!res.ok) {
          setError(body.error ?? "Failed to save");
          return;
        }
        setSavedAt(body.updatedAt);
        router.refresh();
      } catch {
        setError("Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [initial.id, router],
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist({
        title: titleRef.current,
        content: contentRef.current,
      });
    }, 700);
  }, [persist]);

  const insertImage = useCallback(
    async (file: File) => {
      const ed = editorRef.current;
      if (!ed) return;
      if (!isImageFile(file)) {
        setError("Only image files can be inserted");
        return;
      }
      try {
        const src = await compressImageToDataUrl(file);
        const place = nextImagePlacement(ed);
        ed.chain()
          .focus()
          .insertContent({
            type: "image",
            attrs: {
              src,
              x: place.x,
              y: place.y,
              width: place.width,
            },
          })
          .run();
        const nextJson = JSON.stringify(ed.getJSON());
        if (nextJson.length > NOTE_CONTENT_MAX_CHARS) {
          ed.commands.undo();
          setError("Note is too large after that image. Use a smaller picture.");
          return;
        }
        contentRef.current = nextJson;
        scheduleSave();
      } catch {
        setError("Could not insert image");
      }
    },
    [scheduleSave],
  );

  const insertImageRef = useRef(insertImage);
  useEffect(() => {
    insertImageRef.current = insertImage;
  }, [insertImage]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        dropcursor: {
          color: "rgba(196, 169, 154, 0.85)",
          width: 2,
        },
      }),
      NoteImage,
      Placeholder.configure({
        placeholder: "Write notes, paste screenshots, plan drafts…",
      }),
    ],
    content: (() => {
      try {
        return JSON.parse(initial.content) as object;
      } catch {
        return { type: "doc", content: [{ type: "paragraph" }] };
      }
    })(),
    immediatelyRender: false,
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    onDestroy: () => {
      editorRef.current = null;
    },
    editorProps: {
      attributes: {
        class: "note-editor-surface",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              void insertImageRef.current(file);
              return true;
            }
          }
        }
        return false;
      },
      // Only intercept OS file drops — never block dragging an existing image node.
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = files[0];
        if (file && isImageFile(file)) {
          event.preventDefault();
          void insertImageRef.current(file);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = JSON.stringify(ed.getJSON());
      contentRef.current = json;
      if (json.length > NOTE_CONTENT_MAX_CHARS) {
        setError("Note is getting too large — remove some images.");
        return;
      }
      scheduleSave();
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function deleteNote() {
    if (!window.confirm("Delete this note for the whole team?")) return;
    setDeleting(true);
    const res = await fetch(`/api/notes/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Failed to delete");
      setDeleting(false);
      return;
    }
    router.push("/notes");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/notes" className="link-accent text-sm">
          ← All notes
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
          {saving ? (
            <span>Saving…</span>
          ) : (
            <span>Saved · {formatDateTime24(new Date(savedAt))}</span>
          )}
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5 text-sm text-rose-300/90"
            onClick={() => void deleteNote()}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave();
        }}
        onBlur={() => {
          void persist({ title: titleRef.current, content: contentRef.current });
        }}
        className="w-full border-0 bg-transparent font-serif text-2xl font-semibold text-foreground outline-none placeholder:text-faint sm:text-3xl"
        placeholder="Note title"
        maxLength={120}
      />

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
          <ToolbarButton
            label="Bold"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Insert image"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void insertImage(file);
            }}
          />
        </div>
        <div className="note-editor px-4 py-4 sm:px-5">
          <EditorContent editor={editor} />
        </div>
      </div>

      <p className="text-xs text-faint">
        Shared with the team · paste or drop images · drag images freely
        (up/down and left/right) · large pics are compressed automatically
      </p>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active
          ? "bg-accent/20 text-accent-bright"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
