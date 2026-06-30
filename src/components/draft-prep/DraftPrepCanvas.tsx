"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Maximize2, Plus, ZoomIn, ZoomOut } from "lucide-react";
import {
  cellKey,
  PREP_CELL_HEIGHT,
  PREP_CELL_WIDTH,
  PREP_GRID_COLS,
  PREP_GRID_ROWS,
} from "@/lib/draft-prep/scenario-layout";
import {
  loadDraftPrepState,
  newScenarioId,
  nextScenarioTitle,
  saveDraftPrepState,
  type DraftPrepScenario,
} from "@/lib/draft-prep/storage";
import { ScenarioCard } from "./ScenarioCard";
import { PrepChampionPicker } from "./PrepChampionPicker";
import {
  upsertPrepSlotEntry,
  removePrepSlotEntry,
  addPrepExtraBanSlot,
  upsertPrepExtraBanSlot,
  removePrepExtraBanSlot,
  removePrimaryBanSlot,
} from "@/lib/draft-prep/pick-ban-slots";
import { DRAFT_TURNS } from "@/lib/draft";
import type { Side } from "@prisma/client";

type MenuState = { col: number; row: number; x: number; y: number } | null;

type SlotPickerState = {
  scenarioId: string;
  turnIndex: number;
  slotLabel: string;
  extraId?: string;
} | null;

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.12;

function CellZoomLayer({ children }: { children: ReactNode }) {
  return (
    <div
      className="box-border shrink-0 p-2"
      style={{
        width: PREP_CELL_WIDTH,
        height: PREP_CELL_HEIGHT,
      }}
    >
      {children}
    </div>
  );
}

export function DraftPrepCanvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scenarios, setScenarios] = useState<DraftPrepScenario[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 48, y: 48 });
  const [menu, setMenu] = useState<MenuState>(null);
  const [dropTarget, setDropTarget] = useState<{ col: number; row: number } | null>(
    null,
  );
  const [draggingScenarioId, setDraggingScenarioId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [slotPicker, setSlotPicker] = useState<SlotPickerState>(null);
  const panMovedRef = useRef(false);
  const panDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const scenarioDrag = useRef<{
    pointerId: number;
    scenarioId: string;
  } | null>(null);
  const zoomPanRef = useRef({ zoom: 0.85, pan: { x: 48, y: 48 } });

  useEffect(() => {
    zoomPanRef.current = { zoom, pan };
  }, [zoom, pan]);

  const clientToCell = useCallback(
    (clientX: number, clientY: number) => {
      const vp = viewportRef.current;
      if (!vp) return null;
      const rect = vp.getBoundingClientRect();
      const gridX = (clientX - rect.left - pan.x) / zoom;
      const gridY = (clientY - rect.top - pan.y) / zoom;
      const col = Math.floor(gridX / PREP_CELL_WIDTH);
      const row = Math.floor(gridY / PREP_CELL_HEIGHT);
      if (
        col < 0 ||
        col >= PREP_GRID_COLS ||
        row < 0 ||
        row >= PREP_GRID_ROWS
      ) {
        return null;
      }
      return { col, row };
    },
    [pan.x, pan.y, zoom],
  );

  const moveScenario = useCallback(
    (scenarioId: string, col: number, row: number) => {
      setScenarios((prev) => {
        const moving = prev.find((s) => s.id === scenarioId);
        if (!moving) return prev;
        if (moving.col === col && moving.row === row) return prev;
        const occupied = prev.some(
          (s) => s.id !== scenarioId && s.col === col && s.row === row,
        );
        if (occupied) return prev;
        return prev.map((s) => (s.id === scenarioId ? { ...s, col, row } : s));
      });
    },
    [],
  );

  const startScenarioDrag = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, scenarioId: string) => {
      scenarioDrag.current = { pointerId: e.pointerId, scenarioId };
      setDraggingScenarioId(scenarioId);
      setDropTarget(clientToCell(e.clientX, e.clientY));
      viewportRef.current?.setPointerCapture(e.pointerId);
    },
    [clientToCell],
  );

  useEffect(() => {
    const state = loadDraftPrepState();
    setScenarios(state.scenarios);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraftPrepState({ scenarios });
  }, [scenarios, hydrated]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hydrated]);

  const scenarioByCell = useMemo(() => {
    const map = new Map<string, DraftPrepScenario>();
    for (const s of scenarios) {
      map.set(cellKey(s.col, s.row), s);
    }
    return map;
  }, [scenarios]);

  const baseGridWidth = PREP_GRID_COLS * PREP_CELL_WIDTH;
  const baseGridHeight = PREP_GRID_ROWS * PREP_CELL_HEIGHT;

  const clampZoom = useCallback(
    (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  );

  const applyZoomAt = useCallback(
    (mx: number, my: number, targetZoom: number) => {
      const { zoom: oldZoom, pan: oldPan } = zoomPanRef.current;
      const newZoom = clampZoom(targetZoom);
      if (newZoom === oldZoom) return;

      const newPan = {
        x: mx - ((mx - oldPan.x) * newZoom) / oldZoom,
        y: my - ((my - oldPan.y) * newZoom) / oldZoom,
      };

      zoomPanRef.current = { zoom: newZoom, pan: newPan };
      setZoom(newZoom);
      setPan(newPan);
    },
    [clampZoom],
  );

  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const vp = viewportRef.current;
      if (!vp) return;

      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

      applyZoomAt(mx, my, zoomPanRef.current.zoom + delta);
    },
    [applyZoomAt],
  );

  const openCellMenu = useCallback((col: number, row: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const cellLeft =
      pan.x + (col * PREP_CELL_WIDTH + PREP_CELL_WIDTH / 2) * zoom;
    const cellTop =
      pan.y + (row * PREP_CELL_HEIGHT + PREP_CELL_HEIGHT / 2) * zoom;

    const maxX = viewport.clientWidth - 16;
    const maxY = viewport.clientHeight - 16;

    setMenu({
      col,
      row,
      x: Math.min(Math.max(cellLeft, 96), maxX),
      y: Math.min(Math.max(cellTop, 48), maxY),
    });
  }, [pan.x, pan.y, zoom]);

  const onViewportPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "button, input, textarea, select, a, [data-prep-menu], [data-scenario-drag-handle]",
        )
      ) {
        return;
      }
      setMenu(null);
      panMovedRef.current = false;
      panDrag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y],
  );

  const onViewportPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const scenario = scenarioDrag.current;
      if (scenario && scenario.pointerId === e.pointerId) {
        setDropTarget(clientToCell(e.clientX, e.clientY));
        return;
      }

      const drag = panDrag.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 4) panMovedRef.current = true;
      setPan({
        x: drag.panX + dx,
        y: drag.panY + dy,
      });
    },
    [clientToCell],
  );

  const onViewportPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const scenario = scenarioDrag.current;
      if (scenario && scenario.pointerId === e.pointerId) {
        const target = clientToCell(e.clientX, e.clientY);
        if (target) {
          moveScenario(scenario.scenarioId, target.col, target.row);
        }
        scenarioDrag.current = null;
        setDraggingScenarioId(null);
        setDropTarget(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        return;
      }

      if (panDrag.current?.pointerId === e.pointerId) {
        const didPan = panMovedRef.current;
        panDrag.current = null;
        setIsPanning(false);
        e.currentTarget.releasePointerCapture(e.pointerId);

        if (!didPan) {
          const cell = clientToCell(e.clientX, e.clientY);
          if (cell && !scenarioByCell.has(cellKey(cell.col, cell.row))) {
            openCellMenu(cell.col, cell.row);
          }
        }
      }
    },
    [clientToCell, moveScenario, openCellMenu, scenarioByCell],
  );

  const zoomToFit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const padding = 48;
    const scaleX = (vp.clientWidth - padding * 2) / baseGridWidth;
    const scaleY = (vp.clientHeight - padding * 2) / baseGridHeight;
    const nextZoom = clampZoom(Math.min(scaleX, scaleY, 1));
    const nextPan = {
      x: Math.max(padding, (vp.clientWidth - baseGridWidth * nextZoom) / 2),
      y: Math.max(padding, (vp.clientHeight - baseGridHeight * nextZoom) / 2),
    };
    zoomPanRef.current = { zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  }, [clampZoom, baseGridWidth, baseGridHeight]);

  const createScenario = useCallback((col: number, row: number) => {
    setScenarios((prev) => [
      ...prev,
      {
        id: newScenarioId(),
        title: nextScenarioTitle(prev),
        col,
        row,
        pickBans: [],
        extraBanSlots: [],
        notes: "",
      },
    ]);
    setMenu(null);
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notes } : s)),
    );
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetScenario = useCallback((id: string) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, pickBans: [], extraBanSlots: [], notes: "" } : s,
      ),
    );
  }, []);

  const openSlotPicker = useCallback(
    (
      scenarioId: string,
      turnIndex: number,
      slotLabel: string,
      extraId?: string,
    ) => {
      setSlotPicker({ scenarioId, turnIndex, slotLabel, extraId });
    },
    [],
  );

  const confirmSlotPicker = useCallback(
    (champion: string) => {
      if (!slotPicker) return;
      setScenarios((prev) =>
        prev.map((s) => {
          if (s.id !== slotPicker.scenarioId) return s;
          if (slotPicker.extraId) {
            return {
              ...s,
              extraBanSlots: upsertPrepExtraBanSlot(
                s.extraBanSlots ?? [],
                slotPicker.extraId,
                champion,
              ),
            };
          }
          return {
            ...s,
            pickBans: upsertPrepSlotEntry(
              s.pickBans,
              slotPicker.turnIndex,
              champion,
            ),
          };
        }),
      );
      setSlotPicker(null);
    },
    [slotPicker],
  );

  const clearBanSlot = useCallback((scenarioId: string, turnIndex: number) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === scenarioId
          ? { ...s, pickBans: removePrepSlotEntry(s.pickBans, turnIndex) }
          : s,
      ),
    );
  }, []);

  const removeBanExtraSlot = useCallback((scenarioId: string, extraId: string) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === scenarioId
          ? {
              ...s,
              extraBanSlots: removePrepExtraBanSlot(s.extraBanSlots ?? [], extraId),
            }
          : s,
      ),
    );
  }, []);

  const removeBanPrimarySlot = useCallback(
    (scenarioId: string, turnIndex: number, side: Side) => {
      setScenarios((prev) =>
        prev.map((s) => {
          if (s.id !== scenarioId) return s;
          const next = removePrimaryBanSlot(
            s.pickBans,
            s.extraBanSlots ?? [],
            turnIndex,
            side,
          );
          return { ...s, ...next };
        }),
      );
    },
    [],
  );

  const addBanSlot = useCallback(
    (scenarioId: string, turnIndex: number, side: Side, label: string) => {
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === scenarioId
            ? {
                ...s,
                extraBanSlots: addPrepExtraBanSlot(
                  s.extraBanSlots ?? [],
                  turnIndex,
                  side,
                  label,
                ),
              }
            : s,
        ),
      );
    },
    [],
  );

  const pickerScenario = useMemo(
    () =>
      slotPicker
        ? scenarios.find((s) => s.id === slotPicker.scenarioId) ?? null
        : null,
    [slotPicker, scenarios],
  );

  const pickerSlotType = slotPicker
    ? DRAFT_TURNS[slotPicker.turnIndex]?.type ?? "BAN"
    : "BAN";

  const cells = useMemo(() => {
    const out: { col: number; row: number }[] = [];
    for (let row = 0; row < PREP_GRID_ROWS; row++) {
      for (let col = 0; col < PREP_GRID_COLS; col++) {
        out.push({ col, row });
      }
    }
    return out;
  }, []);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        Loading board…
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden bg-[#0a0a0a] ${
          draggingScenarioId || isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        onWheel={handleWheel}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: baseGridWidth,
            height: baseGridHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            ["--prep-zoom" as string]: zoom,
          }}
        >
          <div
            className="mesh-bg pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundSize: `${PREP_CELL_WIDTH}px ${PREP_CELL_HEIGHT}px`,
            }}
            aria-hidden
          />

          {cells.map(({ col, row }) => {
            const key = cellKey(col, row);
            const scenario = scenarioByCell.get(key);
            const isDropHighlight =
              dropTarget?.col === col &&
              dropTarget?.row === row &&
              !scenario;
            return (
              <div
                key={key}
                className={`absolute box-border flex items-center justify-center border transition-colors ${
                  isDropHighlight
                    ? "border-accent bg-accent/10"
                    : "border-border/80"
                }`}
                style={{
                  left: col * PREP_CELL_WIDTH,
                  top: row * PREP_CELL_HEIGHT,
                  width: PREP_CELL_WIDTH,
                  height: PREP_CELL_HEIGHT,
                }}
              >
                <CellZoomLayer>
                  {scenario ? (
                    <ScenarioCard
                      scenario={scenario}
                      isDragging={draggingScenarioId === scenario.id}
                      onNotesChange={(notes) => updateNotes(scenario.id, notes)}
                      onTitleChange={(title) => updateTitle(scenario.id, title)}
                      onDragHandlePointerDown={(e) =>
                        startScenarioDrag(e, scenario.id)
                      }
                      onDelete={() => deleteScenario(scenario.id)}
                      onReset={() => resetScenario(scenario.id)}
                      onSlotClick={(turnIndex, slotLabel, extraId) =>
                        openSlotPicker(
                          scenario.id,
                          turnIndex,
                          slotLabel,
                          extraId,
                        )
                      }
                      onSlotClear={(turnIndex) =>
                        clearBanSlot(scenario.id, turnIndex)
                      }
                      onExtraSlotRemove={(extraId) =>
                        removeBanExtraSlot(scenario.id, extraId)
                      }
                      onPrimarySlotRemove={(turnIndex, side) =>
                        removeBanPrimarySlot(scenario.id, turnIndex, side)
                      }
                      onSlotAdd={(turnIndex, side, slotLabel) =>
                        addBanSlot(scenario.id, turnIndex, side, slotLabel)
                      }
                    />
                  ) : (
                    <div
                      className="group flex h-full w-full cursor-grab items-center justify-center rounded-md border border-transparent transition-colors hover:border-accent/30 hover:bg-accent/5 active:cursor-grabbing"
                      aria-label="Empty scenario cell"
                    >
                      <Plus className="pointer-events-none h-6 w-6 stroke-[1.25] text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  )}
                </CellZoomLayer>
              </div>
            );
          })}
        </div>

        {menu && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-10"
              aria-label="Close menu"
              onPointerDown={(e) => {
                e.stopPropagation();
                setMenu(null);
              }}
            />
            <div
              data-prep-menu
              className="absolute z-20 min-w-[11rem] overflow-hidden rounded-lg border border-border-strong bg-surface-elevated shadow-xl"
              style={{
                left: menu.x,
                top: menu.y,
                transform: "translate(-50%, -50%)",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent/10"
                onClick={() => createScenario(menu.col, menu.row)}
              >
                <Plus className="h-4 w-4 text-accent-bright" />
                Create scenario
              </button>
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          className="btn-ghost flex h-8 w-8 items-center justify-center p-0"
          onClick={() => {
            const vp = viewportRef.current;
            if (!vp) return;
            applyZoomAt(
              vp.clientWidth / 2,
              vp.clientHeight / 2,
              zoomPanRef.current.zoom - ZOOM_STEP,
            );
          }}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="min-w-[3rem] px-1 text-center text-xs tabular-nums text-muted hover:text-foreground"
          onClick={zoomToFit}
          title="Zoom to fit"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="btn-ghost flex h-8 w-8 items-center justify-center p-0"
          onClick={() => {
            const vp = viewportRef.current;
            if (!vp) return;
            applyZoomAt(
              vp.clientWidth / 2,
              vp.clientHeight / 2,
              zoomPanRef.current.zoom + ZOOM_STEP,
            );
          }}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="btn-ghost flex h-8 w-8 items-center justify-center p-0"
          onClick={zoomToFit}
          aria-label="Fit board to view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {slotPicker && pickerScenario && (
        <PrepChampionPicker
          scenarioTitle={pickerScenario.title}
          slotLabel={slotPicker.slotLabel}
          slotType={pickerSlotType}
          onConfirm={confirmSlotPicker}
          onClose={() => setSlotPicker(null)}
        />
      )}
    </div>
  );
}
