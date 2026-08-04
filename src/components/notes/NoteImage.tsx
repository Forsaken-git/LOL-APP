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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function applyOuterPosition(
  editor: Editor,
  getPos: () => number | undefined,
  opts: { x: number; y: number; width: number; zIndex: number },
) {
  const pos = getPos();
  if (typeof pos !== "number") return;
  const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
  if (!dom) return;
  dom.style.position = "absolute";
  dom.style.left = `${opts.x}px`;
  dom.style.top = `${opts.y}px`;
  dom.style.width = `${opts.width}px`;
  dom.style.height = "auto";
  dom.style.margin = "0";
  dom.style.padding = "0";
  dom.style.zIndex = String(opts.zIndex);
  dom.style.overflow = "visible";
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
  const width =
    typeof node.attrs.width === "number" && node.attrs.width > 0
      ? node.attrs.width
      : DEFAULT_WIDTH;
  const x = typeof node.attrs.x === "number" ? node.attrs.x : 24;
  const y = typeof node.attrs.y === "number" ? node.attrs.y : 24;

  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const zIndex = dragging || selected ? 6 : 2;

  useLayoutEffect(() => {
    applyOuterPosition(editor, getPos, { x, y, width, zIndex });
  }, [editor, getPos, width, x, y, zIndex]);

  const ensureCanvasHeight = useCallback(
    (bottom: number) => {
      const root = editor.view.dom as HTMLElement;
      const needed = Math.ceil(bottom + 48);
      const current =
        parseInt(root.style.minHeight || "0", 10) || root.clientHeight;
      if (needed > current) {
        root.style.minHeight = `${needed}px`;
      }
    },
    [editor.view.dom],
  );

  useEffect(() => {
    const imgH = Math.round(width * 0.65);
    ensureCanvasHeight(y + imgH);
  }, [ensureCanvasHeight, width, y]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: x,
        originY: y,
      };
      setDragging(true);
      editor.commands.focus();
    },
    [editor.commands, x, y],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();

      const root = editor.view.dom as HTMLElement;
      const img = event.currentTarget.querySelector("img");
      const imgW = img?.offsetWidth || width;
      const imgH = img?.offsetHeight || Math.round(width * 0.6);
      const maxX = Math.max(0, root.clientWidth - imgW - 4);

      const nextX = clamp(
        drag.originX + (event.clientX - drag.startClientX),
        0,
        maxX,
      );
      const nextY = Math.max(
        0,
        drag.originY + (event.clientY - drag.startClientY),
      );

      ensureCanvasHeight(nextY + imgH);
      applyOuterPosition(editor, getPos, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width,
        zIndex: 6,
      });
      updateAttributes({ x: Math.round(nextX), y: Math.round(nextY) });
    },
    [editor, ensureCanvasHeight, getPos, updateAttributes, width],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }, []);

  return (
    <NodeViewWrapper
      className={`note-image-node${selected ? " is-selected" : ""}${
        dragging ? " is-dragging" : ""
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        title={title || "Drag anywhere"}
        className="note-image"
        draggable={false}
        style={{ width: "100%", height: "auto" }}
      />
    </NodeViewWrapper>
  );
}

/** Freely positioned image — drag on both axes inside the note canvas. */
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
    return ReactNodeViewRenderer(NoteImageView);
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
