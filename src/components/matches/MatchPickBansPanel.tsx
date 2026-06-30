"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Side } from "@prisma/client";
import { championImageUrl } from "@/lib/champions";
import {
  describePickBanCapture,
  slotsForSide,
  type PickBanRow,
} from "@/lib/matches/pick-ban-meta";
import { ChampionDatalist, ChampionInput } from "./ChampionInput";

type Props = {
  matchId: string;
  ourSide: Side;
  source: string | null;
  initialPickBans: PickBanRow[];
  onSaved?: (pickBans: PickBanRow[]) => void;
};

function captureBadgeClass(kind: ReturnType<typeof describePickBanCapture>["kind"]) {
  switch (kind) {
    case "lcu_full":
      return "border-accent/35 bg-accent/10 text-accent-bright";
    case "lcu_partial":
      return "border-amber-500/35 bg-amber-500/10 text-amber-300";
    case "lcu_picks_only":
    case "inferred":
      return "border-border bg-inset/80 text-muted";
    case "imported":
      return "border-sky-500/35 bg-sky-500/10 text-sky-300";
    default:
      return "border-border bg-inset/80 text-faint";
  }
}

function SideDraftColumn({
  side,
  pickBans,
  editing,
  onSlotChange,
}: {
  side: Side;
  pickBans: PickBanRow[];
  editing: boolean;
  onSlotChange: (
    side: Side,
    type: "BAN" | "PICK",
    slotIndex: number,
    champion: string,
  ) => void;
}) {
  const isBlue = side === "BLUE";
  const banSlots = slotsForSide(pickBans, side, "BAN", 5);
  const pickSlots = slotsForSide(pickBans, side, "PICK", 5);

  return (
    <div
      className={`rounded-xl border p-3 ${
        isBlue
          ? "border-sky-500/25 bg-sky-500/[0.04]"
          : "border-rose-500/25 bg-rose-500/[0.04]"
      }`}
    >
      <p
        className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] ${
          isBlue ? "text-sky-300" : "text-rose-300"
        }`}
      >
        {side} side
      </p>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-faint">
            Bans
          </p>
          <div className="flex flex-wrap gap-1.5">
            {banSlots.map((row, i) => (
              <DraftSlot
                key={`ban-${side}-${i}`}
                row={row}
                editing={editing}
                onChange={(champion) => onSlotChange(side, "BAN", i, champion)}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-faint">
            Picks
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pickSlots.map((row, i) => (
              <DraftSlot
                key={`pick-${side}-${i}`}
                row={row}
                editing={editing}
                onChange={(champion) => onSlotChange(side, "PICK", i, champion)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftSlot({
  row,
  editing,
  onChange,
}: {
  row: PickBanRow | null;
  editing: boolean;
  onChange: (champion: string) => void;
}) {
  if (editing) {
    return (
      <div className="w-[4.5rem]">
        <ChampionInput
          value={row?.champion ?? ""}
          onChange={onChange}
          placeholder="—"
          className="w-full px-1.5 py-1 text-xs"
        />
      </div>
    );
  }

  if (!row?.champion) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border bg-inset/50 text-[10px] text-faint"
        title="Empty"
      >
        —
      </div>
    );
  }

  return (
    <img
      src={championImageUrl(row.champion)}
      alt={row.champion}
      title={row.champion}
      className="champion-icon h-9 w-9"
    />
  );
}

function buildEditableRows(pickBans: PickBanRow[]): PickBanRow[] {
  return [...pickBans].sort((a, b) => a.order - b.order);
}

function applySlotEdit(
  rows: PickBanRow[],
  side: Side,
  type: "BAN" | "PICK",
  slotIndex: number,
  champion: string,
): PickBanRow[] {
  const trimmed = champion.trim();
  const sideRows = rows
    .filter((r) => r.side === side && r.type === type)
    .sort((a, b) => a.order - b.order);
  const other = rows.filter((r) => !(r.side === side && r.type === type));

  if (!trimmed) {
    const nextSideRows = sideRows.filter((_, i) => i !== slotIndex);
    return reindexRows([...other, ...nextSideRows]);
  }

  const existing = sideRows[slotIndex];
  if (existing) {
    const updated = sideRows.map((r, i) =>
      i === slotIndex ? { ...r, champion: trimmed } : r,
    );
    return reindexRows([...other, ...updated]);
  }

  const maxOrder = rows.reduce((m, r) => Math.max(m, r.order), -1);
  const newRow: PickBanRow = {
    champion: trimmed,
    type,
    side,
    order: maxOrder + 1,
  };
  const nextSideRows = [...sideRows];
  nextSideRows.splice(slotIndex, 0, newRow);
  return reindexRows([...other, ...nextSideRows]);
}

function reindexRows(rows: PickBanRow[]): PickBanRow[] {
  return rows
    .sort((a, b) => a.order - b.order)
    .map((row, index) => ({ ...row, order: index }));
}

export function MatchPickBansPanel({
  matchId,
  ourSide,
  source,
  initialPickBans,
  onSaved,
}: Props) {
  const [pickBans, setPickBans] = useState(() => buildEditableRows(initialPickBans));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setPickBans(buildEditableRows(initialPickBans));
    }
  }, [initialPickBans, editing]);

  const capture = useMemo(
    () => describePickBanCapture(source, pickBans),
    [source, pickBans],
  );

  const handleSlotChange = useCallback(
    (side: Side, type: "BAN" | "PICK", slotIndex: number, champion: string) => {
      setPickBans((prev) => applySlotEdit(prev, side, type, slotIndex, champion));
    },
    [],
  );

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = reindexRows(pickBans).map(({ champion, type, side, order }) => ({
        champion,
        type,
        side,
        order,
      }));
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickBans: payload }),
      });
      const body = (await res.json().catch(() => null)) as {
        pickBans?: PickBanRow[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Failed to save pick/bans");
      const saved = body?.pickBans ?? payload;
      setPickBans(buildEditableRows(saved));
      setEditing(false);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setPickBans(buildEditableRows(initialPickBans));
    setEditing(false);
    setError("");
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/90 p-4 sm:p-5">
      <ChampionDatalist />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            Pick / ban draft
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${captureBadgeClass(capture.kind)}`}
            >
              {capture.label}
            </span>
            {source && (
              <span className="text-xs text-faint">
                source: <code className="font-mono text-[11px]">{source}</code>
              </span>
            )}
            {ourSide && (
              <span className="text-xs text-faint">
                our side: <span className="text-muted">{ourSide}</span>
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{capture.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className="btn-ghost text-xs"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="btn-primary text-xs"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save draft"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost text-xs"
            >
              Edit pick/bans
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <SideDraftColumn
          side="BLUE"
          pickBans={pickBans}
          editing={editing}
          onSlotChange={handleSlotChange}
        />
        <SideDraftColumn
          side="RED"
          pickBans={pickBans}
          editing={editing}
          onSlotChange={handleSlotChange}
        />
      </div>
    </section>
  );
}
