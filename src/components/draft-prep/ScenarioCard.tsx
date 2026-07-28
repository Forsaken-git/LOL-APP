"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, RotateCcw, Trash2, X } from "lucide-react";
import { championImageUrl } from "@/lib/champions";
import type { DraftEntry } from "@/lib/draft";
import {
  PREP_ROW_MIN_HEIGHT_PX,
  PREP_SIDE_WIDTH_PX,
  PREP_SLOTS_PER_SIDE,
  SCENARIO_ROWS,
} from "@/lib/draft-prep/scenario-layout";
import type { DraftPrepScenario, PrepExtraBanSlot } from "@/lib/draft-prep/storage";
import type { Side } from "@prisma/client";

const SCENARIO_BRONZE = "#8b7355";
const SCENARIO_BG = "#1a1a1a";
const SCENARIO_MAROON = "#3d1f1f";
const SCENARIO_GREEN = "#1f3d2b";
const SLOT_FILL = "#141414";
const SLOT_LABEL = "#9a9a9a";
const PLUS_SLOT_FILL = "rgba(255, 255, 255, 0.06)";

const SLOT_SIZE = "size-9";
const SLOT_ROUNDED = "rounded-md";
const SLOT_BORDER_STYLE = {
  borderWidth: "calc(2px / var(--prep-zoom, 1))",
};
const SLOT_TRANSITION = "transition-colors duration-150";
/**
 * Paint at screen pixels (zoom × DPR), then shrink into the slot so the
 * board's CSS scale() does not upsample a tiny bitmap.
 */
const SHARP_FACE_STYLE = {
  width: "calc(100% * var(--prep-zoom, 1) * var(--prep-dpr, 1))",
  height: "calc(100% * var(--prep-zoom, 1) * var(--prep-dpr, 1))",
  transform:
    "translate(-50%, -50%) scale(calc(1 / (var(--prep-zoom, 1) * var(--prep-dpr, 1))))",
  borderRadius: "calc(0.375rem * var(--prep-zoom, 1) * var(--prep-dpr, 1))",
} as const;
/** Same pipeline as champ portraits — bitmap/SVG img + filter layer promotion. */
const SLOT_IMG_CLASS =
  "pointer-events-none absolute left-1/2 top-1/2 block max-w-none object-cover select-none [filter:brightness(1)] will-change-[filter] transition-[filter] duration-150 group-hover/slot:brightness-110";
const CHAMP_IMG_STYLE = {
  ...SHARP_FACE_STYLE,
} as const;
const CHAMP_HOVER_OVERLAY = `pointer-events-none absolute inset-0 z-[1] rounded-md border border-solid border-[#a68b7c] opacity-0 ${SLOT_TRANSITION} group-hover/slot:opacity-100`;

/** High-res SVG faces so empty/plus slots share the champ img sharpness path. */
function slotFaceDataUrl(kind: "label" | "plus", label = ""): string {
  const safe = label.replace(/[<>&"']/g, "");
  const fill = kind === "plus" ? PLUS_SLOT_FILL : SLOT_FILL;
  const mark =
    kind === "plus"
      ? `<path d="M18 11v14M11 18h14" fill="none" stroke="#b8aea6" stroke-width="2.25" stroke-linecap="round"/>`
      : `<text x="18" y="19.5" text-anchor="middle" dominant-baseline="middle" fill="${SLOT_LABEL}" font-family="ui-sans-serif,system-ui,Segoe UI,sans-serif" font-size="11" font-weight="700">${safe}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 36 36"><rect x="1" y="1" width="34" height="34" rx="6" ry="6" fill="${fill}" stroke="#4a4540" stroke-width="1.5" stroke-dasharray="3.5 2.5"/>${mark}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PLUS_FACE_SRC = slotFaceDataUrl("plus");

function championAt(entries: DraftEntry[], turnIndex: number): string | null {
  const entry = entries.find((e) => e.order === turnIndex);
  return entry?.champion?.trim() ? entry.champion : null;
}

function SlotFaceImg({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      decoding="async"
      className={SLOT_IMG_CLASS}
      style={CHAMP_IMG_STYLE}
    />
  );
}

function PlusSlot({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <div className={`group/slot relative ${SLOT_SIZE} shrink-0 ${SLOT_ROUNDED}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="absolute inset-0 rounded-md border-0 bg-transparent p-0"
        aria-label={`Add ${label}`}
      >
        <SlotFaceImg src={PLUS_FACE_SRC} alt="" />
      </button>
      <div className={CHAMP_HOVER_OVERLAY} style={SLOT_BORDER_STYLE} aria-hidden />
    </div>
  );
}

function DraftSlot({
  label,
  champion,
  onClick,
  onClear,
  onRemove,
}: {
  label: string;
  champion: string | null;
  onClick?: () => void;
  onClear?: () => void;
  onRemove?: () => void;
}) {
  const deleteAction = onRemove ?? (champion && onClear ? onClear : undefined);
  const deleteLabel = onRemove ? "Remove slot" : "Remove champion";

  const slotBody = champion ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="absolute inset-0 rounded-md border-0 bg-[#0d0d0d] p-0"
      title={champion}
      aria-label={`Edit ${label}: ${champion}`}
    >
      <img
        src={championImageUrl(champion, "square")}
        alt={champion}
        draggable={false}
        decoding="async"
        className={SLOT_IMG_CLASS}
        style={CHAMP_IMG_STYLE}
      />
    </button>
  ) : onClick ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute inset-0 rounded-md border-0 bg-transparent p-0"
      aria-label={`Add ${label}`}
    >
      <SlotFaceImg src={slotFaceDataUrl("label", label)} alt={label} />
    </button>
  ) : (
    <div className="absolute inset-0 rounded-md">
      <SlotFaceImg src={slotFaceDataUrl("label", label)} alt={label} />
    </div>
  );

  return (
    <div className={`group/slot relative ${SLOT_SIZE} shrink-0 ${SLOT_ROUNDED}`}>
      {slotBody}
      <div className={CHAMP_HOVER_OVERLAY} style={SLOT_BORDER_STYLE} aria-hidden />
      {deleteAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            deleteAction();
          }}
          className="absolute right-px top-px z-10 flex h-3 w-3 items-center justify-center rounded-sm bg-black/55 text-red-400 opacity-0 shadow-sm backdrop-blur-[2px] transition-all hover:bg-black/70 hover:text-red-300 group-hover/slot:opacity-100"
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function BlueSide({
  label,
  champion,
  extras,
  onPlusClick,
  onSlotClick,
  onSlotClear,
  onPrimarySlotRemove,
  onExtraSlotClick,
  onExtraSlotRemove,
}: {
  label: string;
  champion: string | null;
  extras: PrepExtraBanSlot[];
  onPlusClick?: () => void;
  onSlotClick?: () => void;
  onSlotClear?: () => void;
  onPrimarySlotRemove?: () => void;
  onExtraSlotClick?: (extraId: string) => void;
  onExtraSlotRemove?: (extraId: string) => void;
}) {
  const canAddMore = extras.length < PREP_SLOTS_PER_SIDE - 1;
  const showPlus = Boolean(onPlusClick && canAddMore);
  const hasOtherSlots = extras.length > 0;

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center justify-end gap-1">
        {showPlus && <PlusSlot label={label} onClick={onPlusClick} />}
        {extras.map((extra) => (
          <DraftSlot
            key={extra.id}
            label={label}
            champion={extra.champion}
            onClick={() => onExtraSlotClick?.(extra.id)}
            onRemove={() => onExtraSlotRemove?.(extra.id)}
          />
        ))}
        <DraftSlot
          label={label}
          champion={champion}
          onClick={onSlotClick}
          onClear={hasOtherSlots ? undefined : onSlotClear}
          onRemove={hasOtherSlots ? onPrimarySlotRemove : undefined}
        />
      </div>
    </div>
  );
}

function RedSide({
  label,
  champion,
  extras,
  onPlusClick,
  onSlotClick,
  onSlotClear,
  onPrimarySlotRemove,
  onExtraSlotClick,
  onExtraSlotRemove,
}: {
  label: string;
  champion: string | null;
  extras: PrepExtraBanSlot[];
  onPlusClick?: () => void;
  onSlotClick?: () => void;
  onSlotClear?: () => void;
  onPrimarySlotRemove?: () => void;
  onExtraSlotClick?: (extraId: string) => void;
  onExtraSlotRemove?: (extraId: string) => void;
}) {
  const canAddMore = extras.length < PREP_SLOTS_PER_SIDE - 1;
  const showPlus = Boolean(onPlusClick && canAddMore);
  const hasOtherSlots = extras.length > 0;

  return (
    <div className="flex items-center justify-start">
      <div className="flex items-center justify-start gap-1">
        <DraftSlot
          label={label}
          champion={champion}
          onClick={onSlotClick}
          onClear={hasOtherSlots ? undefined : onSlotClear}
          onRemove={hasOtherSlots ? onPrimarySlotRemove : undefined}
        />
        {extras.map((extra) => (
          <DraftSlot
            key={extra.id}
            label={label}
            champion={extra.champion}
            onClick={() => onExtraSlotClick?.(extra.id)}
            onRemove={() => onExtraSlotRemove?.(extra.id)}
          />
        ))}
        {showPlus && <PlusSlot label={label} onClick={onPlusClick} />}
      </div>
    </div>
  );
}

export function ScenarioCard({
  scenario,
  onNotesChange,
  onTitleChange,
  onDragHandlePointerDown,
  onDelete,
  onReset,
  onSlotClick,
  onSlotClear,
  onPrimarySlotRemove,
  onExtraSlotRemove,
  onSlotAdd,
  isDragging,
}: {
  scenario: DraftPrepScenario;
  onNotesChange?: (notes: string) => void;
  onTitleChange?: (title: string) => void;
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onDelete?: () => void;
  onReset?: () => void;
  onSlotClick?: (
    turnIndex: number,
    slotLabel: string,
    extraId?: string,
  ) => void;
  onSlotClear?: (turnIndex: number) => void;
  onExtraSlotRemove?: (extraId: string) => void;
  onPrimarySlotRemove?: (turnIndex: number, side: Side) => void;
  onSlotAdd?: (turnIndex: number, side: Side, slotLabel: string) => void;
  isDragging?: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(scenario.title);

  useEffect(() => {
    if (!editingTitle) setDraftTitle(scenario.title);
  }, [scenario.title, editingTitle]);

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== scenario.title) {
      onTitleChange?.(trimmed);
    } else {
      setDraftTitle(scenario.title);
    }
    setEditingTitle(false);
  };

  return (
    <article
      className="group relative flex h-full w-full flex-col overflow-visible rounded-md p-2 transition-opacity"
      style={{
        backgroundColor: SCENARIO_BG,
        border: `1px solid ${SCENARIO_BRONZE}`,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {(onDelete || onReset) && (
        <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onReset && (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-[#9a9a9a] transition-colors hover:bg-white/10 hover:text-[#d1c7c1]"
              aria-label="Reset scenario"
              title="Reset picks, bans, and notes"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-[#9a9a9a] transition-colors hover:bg-rose-500/20 hover:text-rose-300"
              aria-label="Delete scenario"
              title="Delete scenario"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}

      <header className="mb-1.5 flex shrink-0 items-center gap-2 pr-14">
        <button
          type="button"
          data-scenario-drag-handle
          className="cursor-grab rounded p-0.5 transition-colors hover:bg-white/5 active:cursor-grabbing"
          style={{ color: SCENARIO_BRONZE }}
          aria-label="Drag scenario"
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragHandlePointerDown?.(e);
          }}
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </button>
        {editingTitle ? (
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setDraftTitle(scenario.title);
                setEditingTitle(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold uppercase tracking-wide focus:ring-0"
            style={{ color: SCENARIO_BRONZE }}
            autoFocus
            aria-label="Scenario name"
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-sm font-bold uppercase tracking-wide transition-colors hover:text-[#d1c7c1]"
            style={{ color: SCENARIO_BRONZE }}
            title="Click to rename"
            onClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {scenario.title}
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[2px]">
        {SCENARIO_ROWS.map((row) => {
          const rowBg = row.kind === "ban" ? SCENARIO_MAROON : SCENARIO_GREEN;
          const openSlot = (
            turnIndex: number,
            slotLabel: string,
            extraId?: string,
          ) => {
            onSlotClick?.(turnIndex, slotLabel, extraId);
          };
          const blueExtras =
            scenario.extraBanSlots?.filter(
              (slot) =>
                slot.turnIndex === row.blue.turnIndex && slot.side === "BLUE",
            ) ?? [];
          const redExtras =
            scenario.extraBanSlots?.filter(
              (slot) =>
                slot.turnIndex === row.red.turnIndex && slot.side === "RED",
            ) ?? [];
          return (
            <div
              key={`${row.blue.turnIndex}-${row.red.turnIndex}`}
              className="grid flex-1 items-center gap-2 overflow-visible px-2 py-1"
              style={{
                backgroundColor: rowBg,
                minHeight: PREP_ROW_MIN_HEIGHT_PX,
                gridTemplateColumns: `minmax(${PREP_SIDE_WIDTH_PX}px, 1fr) auto minmax(${PREP_SIDE_WIDTH_PX}px, 1fr)`,
              }}
            >
              <BlueSide
                label={row.blue.label}
                champion={championAt(scenario.pickBans, row.blue.turnIndex)}
                extras={blueExtras}
                onPlusClick={() =>
                  onSlotAdd?.(row.blue.turnIndex, "BLUE", row.blue.label)
                }
                onSlotClick={() => openSlot(row.blue.turnIndex, row.blue.label)}
                onSlotClear={() => onSlotClear?.(row.blue.turnIndex)}
                onPrimarySlotRemove={() =>
                  onPrimarySlotRemove?.(row.blue.turnIndex, "BLUE")
                }
                onExtraSlotClick={(extraId) =>
                  openSlot(row.blue.turnIndex, row.blue.label, extraId)
                }
                onExtraSlotRemove={onExtraSlotRemove}
              />
              <div
                className="w-1 shrink-0 self-stretch rounded-full"
                style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
                aria-hidden
              />
              <RedSide
                label={row.red.label}
                champion={championAt(scenario.pickBans, row.red.turnIndex)}
                extras={redExtras}
                onPlusClick={() =>
                  onSlotAdd?.(row.red.turnIndex, "RED", row.red.label)
                }
                onSlotClick={() => openSlot(row.red.turnIndex, row.red.label)}
                onSlotClear={() => onSlotClear?.(row.red.turnIndex)}
                onPrimarySlotRemove={() =>
                  onPrimarySlotRemove?.(row.red.turnIndex, "RED")
                }
                onExtraSlotClick={(extraId) =>
                  openSlot(row.red.turnIndex, row.red.label, extraId)
                }
                onExtraSlotRemove={onExtraSlotRemove}
              />
            </div>
          );
        })}
      </div>

      <footer
        className="mt-2 shrink-0 pt-2"
        style={{ borderTop: `1px solid ${SCENARIO_BRONZE}40` }}
      >
        <input
          type="text"
          value={scenario.notes}
          onChange={(e) => onNotesChange?.(e.target.value)}
          placeholder="Add notes..."
          className="w-full border-0 bg-transparent px-0 py-0.5 text-left text-xs text-[#9a9a9a] placeholder:text-[#6b635d] focus:ring-0"
        />
      </footer>
    </article>
  );
}
