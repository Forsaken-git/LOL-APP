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
  const [resizing, setResizing] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeRef = useRef<{
    corner: ResizeCorner;
    startClientX: number;
    originX: number;
    originY: number;
    originWidth: number;
    aspect: number;
  } | null>(null);
  const attrsRef = useRef({ x, y, width, updateAttributes, editor, getPos });
  attrsRef.current = { x, y, width, updateAttributes, editor, getPos };

  const active = dragging || resizing || selected;
  const zIndex = active ? 6 : 2;

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
    const imgH = imgRef.current?.offsetHeight || Math.round(width * 0.65);
    ensureCanvasHeight(y + imgH);
  }, [ensureCanvasHeight, width, y]);

  const stopWindowTracking = useRef<() => void>(() => {});

  const startWindowTracking = useCallback(() => {
    stopWindowTracking.current();

    const onMove = (ev: PointerEvent) => {
      const {
        editor: ed,
        getPos: gp,
        updateAttributes: upd,
        width: w,
      } = attrsRef.current;

      const resize = resizeRef.current;
      if (resize) {
        ev.preventDefault();
        const root = ed.view.dom as HTMLElement;
        const dx = ev.clientX - resize.startClientX;
        let nextWidth =
          resize.corner === "se" || resize.corner === "ne"
            ? resize.originWidth + dx
            : resize.originWidth - dx;

        const maxW = Math.min(MAX_WIDTH, root.clientWidth - 8);
        nextWidth = clamp(nextWidth, MIN_WIDTH, maxW);

        let nextX = resize.originX;
        let nextY = resize.originY;
        if (resize.corner === "sw" || resize.corner === "nw") {
          nextX = resize.originX + (resize.originWidth - nextWidth);
        }
        if (resize.corner === "ne" || resize.corner === "nw") {
          nextY =
            resize.originY +
            (resize.originWidth - nextWidth) * resize.aspect;
        }

        nextX = clamp(nextX, 0, Math.max(0, root.clientWidth - nextWidth - 4));
        nextY = Math.max(0, nextY);
        const nextH = nextWidth * resize.aspect;
        const rootEl = ed.view.dom as HTMLElement;
        const needed = Math.ceil(nextY + nextH + 48);
        if (
          needed >
          (parseInt(rootEl.style.minHeight || "0", 10) || rootEl.clientHeight)
        ) {
          rootEl.style.minHeight = `${needed}px`;
        }

        applyOuterPosition(ed, gp, {
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.round(nextWidth),
          zIndex: 6,
        });
        upd({
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.round(nextWidth),
        });
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      ev.preventDefault();

      const root = ed.view.dom as HTMLElement;
      const img = imgRef.current;
      const imgW = img?.offsetWidth || w;
      const imgH = img?.offsetHeight || Math.round(w * 0.6);
      const maxX = Math.max(0, root.clientWidth - imgW - 4);
      const nextX = clamp(
        drag.originX + (ev.clientX - drag.startClientX),
        0,
        maxX,
      );
      const nextY = Math.max(
        0,
        drag.originY + (ev.clientY - drag.startClientY),
      );

      const needed = Math.ceil(nextY + imgH + 48);
      if (
        needed >
        (parseInt(root.style.minHeight || "0", 10) || root.clientHeight)
      ) {
        root.style.minHeight = `${needed}px`;
      }

      applyOuterPosition(ed, gp, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: w,
        zIndex: 6,
      });
      upd({ x: Math.round(nextX), y: Math.round(nextY) });
    };

    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      setDragging(false);
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    stopWindowTracking.current = onUp;
  }, []);

  useEffect(() => () => stopWindowTracking.current(), []);

  const onMovePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("[data-resize-handle]")) return;

      event.preventDefault();
      event.stopPropagation();

      dragRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: x,
        originY: y,
      };
      setDragging(true);
      editor.commands.focus();
      startWindowTracking();
    },
    [editor.commands, startWindowTracking, x, y],
  );

  const onResizePointerDown = useCallback(
    (corner: ResizeCorner) => (event: React.PointerEvent<HTMLSpanElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const naturalW = imgRef.current?.naturalWidth || width;
      const naturalH = imgRef.current?.naturalHeight || width;
      const displayedH = imgRef.current?.offsetHeight;
      const aspect =
        displayedH && width > 0
          ? displayedH / width
          : naturalW > 0 && naturalH > 0
            ? naturalH / naturalW
            : 0.6;

      resizeRef.current = {
        corner,
        startClientX: event.clientX,
        originX: x,
        originY: y,
        originWidth: width,
        aspect,
      };
      setResizing(true);
      editor.commands.focus();
      startWindowTracking();
    },
    [editor.commands, startWindowTracking, width, x, y],
  );

  return (
    <NodeViewWrapper
      className={`note-image-node${selected || resizing ? " is-selected" : ""}${
        dragging ? " is-dragging" : ""
      }${resizing ? " is-resizing" : ""}`}
      onPointerDown={onMovePointerDown}
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
        onPointerDown={onResizePointerDown("nw")}
      />
      <span
        data-resize-handle="ne"
        className="note-image-handle note-image-handle--ne"
        onPointerDown={onResizePointerDown("ne")}
      />
      <span
        data-resize-handle="sw"
        className="note-image-handle note-image-handle--sw"
        onPointerDown={onResizePointerDown("sw")}
      />
      <span
        data-resize-handle="se"
        className="note-image-handle note-image-handle--se"
        onPointerDown={onResizePointerDown("se")}
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
