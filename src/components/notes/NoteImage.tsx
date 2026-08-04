"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 80;
const MAX_WIDTH = 1400;

type ResizeCorner = "nw" | "ne" | "sw" | "se";

type Box = { x: number; y: number; width: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readBox(node: NodeViewProps["node"]): Box {
  return {
    x: typeof node.attrs.x === "number" ? node.attrs.x : 24,
    y: typeof node.attrs.y === "number" ? node.attrs.y : 24,
    width:
      typeof node.attrs.width === "number" && node.attrs.width > 0
        ? node.attrs.width
        : DEFAULT_WIDTH,
  };
}

function applyOuterBox(
  editor: Editor,
  getPos: () => number | undefined,
  box: Box,
  zIndex: number,
) {
  const pos = getPos();
  if (typeof pos !== "number") return null;
  const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
  if (!dom) return null;
  dom.style.position = "absolute";
  dom.style.left = `${box.x}px`;
  dom.style.top = `${box.y}px`;
  dom.style.width = `${box.width}px`;
  dom.style.height = "auto";
  dom.style.margin = "0";
  dom.style.padding = "0";
  dom.style.zIndex = String(zIndex);
  dom.style.overflow = "visible";
  dom.style.pointerEvents = "auto";
  return dom;
}

function ensureCanvasHeight(editor: Editor, bottom: number) {
  const root = editor.view.dom as HTMLElement;
  const needed = Math.ceil(bottom + 48);
  const current =
    parseInt(root.style.minHeight || "0", 10) || root.clientHeight;
  if (needed > current) {
    root.style.minHeight = `${needed}px`;
  }
}

function NoteImageView({
  node,
  selected,
  updateAttributes,
  editor,
  getPos,
}: NodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const title =
    typeof node.attrs.title === "string" ? node.attrs.title : undefined;

  const nodeBox = readBox(node);
  /** Live geometry while dragging/resizing — commit to the doc only on pointerup. */
  const [liveBox, setLiveBox] = useState<Box | null>(null);
  const box = liveBox ?? nodeBox;

  const [interacting, setInteracting] = useState<"move" | "resize" | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const boxRef = useRef(box);
  boxRef.current = box;

  const sessionRef = useRef<
    | {
        mode: "move";
        startClientX: number;
        startClientY: number;
        origin: Box;
      }
    | {
        mode: "resize";
        corner: ResizeCorner;
        startClientX: number;
        origin: Box;
        aspect: number;
      }
    | null
  >(null);

  const zIndex = interacting || selected ? 6 : 2;
  const isInteracting = interacting !== null;

  // Sync outer wrapper whenever geometry changes (from props or live drag).
  useLayoutEffect(() => {
    applyOuterBox(editor, getPos, box, zIndex);
    const h = imgRef.current?.offsetHeight || Math.round(box.width * 0.65);
    ensureCanvasHeight(editor, box.y + h);
  }, [box, editor, getPos, zIndex]);

  // If the document attrs change externally (e.g. undo), drop stale live box.
  useEffect(() => {
    if (isInteracting) return;
    setLiveBox(null);
  }, [nodeBox.x, nodeBox.y, nodeBox.width, isInteracting]);

  const endSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setInteracting(null);

    if (!session) {
      setLiveBox(null);
      return;
    }

    const finalBox = boxRef.current;
    setLiveBox(null);
    updateAttributes({
      x: Math.round(finalBox.x),
      y: Math.round(finalBox.y),
      width: Math.round(finalBox.width),
    });
  }, [updateAttributes]);

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      ev.preventDefault();

      const root = editor.view.dom as HTMLElement;

      if (session.mode === "resize") {
        const dx = ev.clientX - session.startClientX;
        let nextWidth =
          session.corner === "se" || session.corner === "ne"
            ? session.origin.width + dx
            : session.origin.width - dx;

        const maxW = Math.min(MAX_WIDTH, root.clientWidth - 8);
        nextWidth = clamp(nextWidth, MIN_WIDTH, maxW);

        let nextX = session.origin.x;
        let nextY = session.origin.y;
        if (session.corner === "sw" || session.corner === "nw") {
          nextX = session.origin.x + (session.origin.width - nextWidth);
        }
        if (session.corner === "ne" || session.corner === "nw") {
          nextY =
            session.origin.y +
            (session.origin.width - nextWidth) * session.aspect;
        }

        nextX = clamp(nextX, 0, Math.max(0, root.clientWidth - nextWidth - 4));
        nextY = Math.max(0, nextY);

        const next: Box = {
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.round(nextWidth),
        };
        boxRef.current = next;
        setLiveBox(next);
        applyOuterBox(editor, getPos, next, 6);
        ensureCanvasHeight(editor, next.y + next.width * session.aspect);
        return;
      }

      const img = imgRef.current;
      const imgW = img?.offsetWidth || session.origin.width;
      const imgH = img?.offsetHeight || Math.round(session.origin.width * 0.6);
      const maxX = Math.max(0, root.clientWidth - imgW - 4);
      const next: Box = {
        x: Math.round(
          clamp(session.origin.x + (ev.clientX - session.startClientX), 0, maxX),
        ),
        y: Math.round(
          Math.max(0, session.origin.y + (ev.clientY - session.startClientY)),
        ),
        width: session.origin.width,
      };
      boxRef.current = next;
      setLiveBox(next);
      applyOuterBox(editor, getPos, next, 6);
      ensureCanvasHeight(editor, next.y + imgH);
    };

    const onUp = () => {
      if (!sessionRef.current) return;
      endSession();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [editor, endSession, getPos]);

  const beginMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("[data-resize-handle]")) return;
      event.preventDefault();
      event.stopPropagation();

      const origin = { ...boxRef.current };
      sessionRef.current = {
        mode: "move",
        startClientX: event.clientX,
        startClientY: event.clientY,
        origin,
      };
      setLiveBox(origin);
      setInteracting("move");
      editor.commands.focus();
    },
    [editor.commands],
  );

  const beginResize = useCallback(
    (corner: ResizeCorner) => (event: React.PointerEvent<HTMLSpanElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const origin = { ...boxRef.current };
      const displayedH = imgRef.current?.offsetHeight;
      const naturalW = imgRef.current?.naturalWidth || origin.width;
      const naturalH = imgRef.current?.naturalHeight || origin.width;
      const aspect =
        displayedH && origin.width > 0
          ? displayedH / origin.width
          : naturalW > 0 && naturalH > 0
            ? naturalH / naturalW
            : 0.6;

      sessionRef.current = {
        mode: "resize",
        corner,
        startClientX: event.clientX,
        origin,
        aspect,
      };
      setLiveBox(origin);
      setInteracting("resize");
      editor.commands.focus();
    },
    [editor.commands],
  );

  return (
    <NodeViewWrapper
      className={`note-image-node${selected || isInteracting ? " is-selected" : ""}${
        interacting === "move" ? " is-dragging" : ""
      }${interacting === "resize" ? " is-resizing" : ""}`}
      onPointerDown={beginMove}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        title={title || "Drag to move · corner handles to resize"}
        className="note-image"
        draggable={false}
        style={{ width: "100%", height: "auto" }}
      />
      <span
        data-resize-handle="nw"
        className="note-image-handle note-image-handle--nw"
        onPointerDown={beginResize("nw")}
      />
      <span
        data-resize-handle="ne"
        className="note-image-handle note-image-handle--ne"
        onPointerDown={beginResize("ne")}
      />
      <span
        data-resize-handle="sw"
        className="note-image-handle note-image-handle--sw"
        onPointerDown={beginResize("sw")}
      />
      <span
        data-resize-handle="se"
        className="note-image-handle note-image-handle--se"
        onPointerDown={beginResize("se")}
      />
    </NodeViewWrapper>
  );
}

/** Freely positioned image — drag on both axes; resize from corner handles. */
export const NoteImage = Image.extend({
  name: "image",
  group: "block",
  draggable: false,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      x: {
        default: 24,
        parseHTML: (el) => {
          const v = el.getAttribute("data-x");
          const n = v != null ? Number(v) : NaN;
          return Number.isFinite(n) ? n : 24;
        },
        renderHTML: (attrs) => ({ "data-x": String(attrs.x ?? 24) }),
      },
      y: {
        default: 24,
        parseHTML: (el) => {
          const v = el.getAttribute("data-y");
          const n = v != null ? Number(v) : NaN;
          return Number.isFinite(n) ? n : 24;
        },
        renderHTML: (attrs) => ({ "data-y": String(attrs.y ?? 24) }),
      },
      width: {
        default: DEFAULT_WIDTH,
        parseHTML: (el) => {
          const v = el.getAttribute("data-width") || el.getAttribute("width");
          const n = v != null ? Number(v) : NaN;
          return Number.isFinite(n) && n > 0 ? n : DEFAULT_WIDTH;
        },
        renderHTML: (attrs) => ({
          "data-width": String(attrs.width ?? DEFAULT_WIDTH),
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView, {
      // Keep the React view stable across attribute updates.
      stopEvent: ({ event }) => {
        const t = event.target as HTMLElement | null;
        return Boolean(
          t?.closest?.(".note-image-node") || t?.closest?.("[data-resize-handle]"),
        );
      },
    });
  },
}).configure({
  allowBase64: true,
  inline: false,
  HTMLAttributes: {
    class: "note-image",
  },
});

/** Place a new image near the caret (or stacked if caret coords fail). */
export function nextImagePlacement(editor: Editor): {
  x: number;
  y: number;
  width: number;
} {
  const root = editor.view.dom;
  const rootRect = root.getBoundingClientRect();
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") count += 1;
  });

  try {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    return {
      x: clamp(
        Math.round(coords.left - rootRect.left),
        16,
        Math.max(16, root.clientWidth - DEFAULT_WIDTH - 16),
      ),
      y: Math.max(16, Math.round(coords.top - rootRect.top + root.scrollTop)),
      width: DEFAULT_WIDTH,
    };
  } catch {
    return {
      x: 24 + (count % 4) * 24,
      y: 24 + count * 24,
      width: DEFAULT_WIDTH,
    };
  }
}
