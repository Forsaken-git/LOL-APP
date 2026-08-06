"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { CHAMPIONS, championImageUrl } from "@/lib/champions";
import {
  championPlaysDraftLane,
  sortChampionsByDraftPosition,
  type DraftLane,
} from "@/lib/draft-positions";
import { formatTeamRole } from "@/lib/player-stats";
import {
  allPlacedChampions,
  emptyTierlistData,
  findTierId,
  tierlistDataEqual,
  tierRowStyle,
  type TierlistData,
} from "@/lib/tierlist";
import type { TierlistPlayerOption } from "./TierlistsView";

type DragSource = { champion: string; from: string | "pool" };
type DropTarget =
  | { kind: "pool" }
  | { kind: "tier"; tierId: string; index: number };

const ROLE_TABS: { id: DraftLane; label: string }[] = [
  { id: "TOP", label: "Top" },
  { id: "JUNGLE", label: "Jng" },
  { id: "MID", label: "Mid" },
  { id: "ADC", label: "ADC" },
  { id: "SUPPORT", label: "Sup" },
];

export function TierlistEditor({
  id,
  name: initialName,
  initialData,
  initialPlayerId,
  players,
}: {
  id: string;
  name: string;
  initialData: TierlistData;
  initialPlayerId: string | null;
  players: TierlistPlayerOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [playerId, setPlayerId] = useState(initialPlayerId ?? "");
  const [data, setData] = useState<TierlistData>(initialData);
  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState<DraftLane | null>(null);
  const [iconSize, setIconSize] = useState(40);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    name !== initialName ||
    playerId !== (initialPlayerId ?? "") ||
    !tierlistDataEqual(data, initialData);
  const placed = useMemo(() => allPlacedChampions(data), [data]);
  const totalPlaced = placed.size;

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = CHAMPIONS.filter((c) => {
      if (placed.has(c)) return false;
      if (q && !c.toLowerCase().includes(q)) return false;
      if (roleTab && !championPlaysDraftLane(c, roleTab)) return false;
      return true;
    });
    // Role tabs: alpha within lane. No tab: wiki lane order (Top → Support).
    if (roleTab) {
      return [...filtered].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    }
    return sortChampionsByDraftPosition(filtered);
  }, [placed, search, roleTab]);

  const renameTier = useCallback((tierId: string, label: string) => {
    setData((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) =>
        t.id === tierId ? { ...t, label: label.slice(0, 32) } : t,
      ),
    }));
  }, []);

  const addTier = useCallback(() => {
    setData((prev) => {
      const baseLabel = `Tier ${prev.tiers.length + 1}`;
      const baseId = baseLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const existing = new Set(prev.tiers.map((t) => t.id));
      let id = baseId || `tier-${prev.tiers.length + 1}`;
      let i = 2;
      while (existing.has(id)) {
        id = `${baseId || "tier"}-${i++}`;
      }
      return {
        tiers: [...prev.tiers, { id, label: baseLabel }],
        rows: { ...prev.rows, [id]: [] },
      };
    });
  }, []);

  const removeTier = useCallback((tierId: string) => {
    setData((prev) => {
      if (prev.tiers.length <= 1) return prev;
      const nextTiers = prev.tiers.filter((t) => t.id !== tierId);
      const nextRows = { ...prev.rows };
      delete nextRows[tierId];
      return { tiers: nextTiers, rows: nextRows };
    });
  }, []);

  const moveChampion = useCallback(
    (
      champion: string,
      toTierId: string,
      toIndex: number,
      from?: string | "pool",
    ) => {
      setData((prev) => {
        const rows: Record<string, string[]> = {};
        for (const t of prev.tiers) {
          rows[t.id] = [...(prev.rows[t.id] ?? [])];
        }

        const sourceTier =
          from === "pool" ? null : from ?? findTierId(prev, champion);

        let fromIndex = -1;
        if (sourceTier) {
          fromIndex = rows[sourceTier].indexOf(champion);
          rows[sourceTier] = rows[sourceTier].filter((c) => c !== champion);
        } else if (from !== "pool") {
          for (const t of prev.tiers) {
            const i = rows[t.id].indexOf(champion);
            if (i >= 0) {
              fromIndex = i;
              rows[t.id] = rows[t.id].filter((c) => c !== champion);
              break;
            }
          }
        }

        const list = rows[toTierId] ?? [];
        let insertAt = Math.max(0, Math.min(toIndex, list.length));
        if (sourceTier === toTierId && fromIndex >= 0 && fromIndex < insertAt) {
          insertAt -= 1;
        }
        if (!list.includes(champion)) {
          list.splice(insertAt, 0, champion);
        }
        rows[toTierId] = list;

        return { ...prev, rows };
      });
      setSelected(null);
    },
    [],
  );

  const moveToTier = useCallback(
    (champion: string, tierId: string, from?: string | "pool") => {
      // Append to end of the tier (click / number-key place).
      moveChampion(champion, tierId, Number.MAX_SAFE_INTEGER, from);
    },
    [moveChampion],
  );

  const removeToPool = useCallback((champion: string) => {
    setData((prev) => {
      const tierId = findTierId(prev, champion);
      if (!tierId) return prev;
      return {
        ...prev,
        rows: {
          ...prev.rows,
          [tierId]: (prev.rows[tierId] ?? []).filter((c) => c !== champion),
        },
      };
    });
    setSelected((s) => (s === champion ? null : s));
  }, []);

  const handleDrop = useCallback(
    (target: DropTarget) => {
      if (!dragging) return;
      if (target.kind === "pool") {
        removeToPool(dragging.champion);
      } else {
        moveChampion(
          dragging.champion,
          target.tierId,
          target.index,
          dragging.from,
        );
      }
      setDragging(null);
      setDropTarget(null);
    },
    [dragging, moveChampion, removeToPool],
  );

  async function save() {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/tierlists/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rows: data,
        playerId: playerId.length > 0 ? playerId : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSaveError(body?.error ?? "Failed to save tierlist");
      return;
    }
    setSavedFlash(true);
    router.refresh();
  }

  async function deleteTierlist() {
    if (deleting) return;
    const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;

    setDeleting(true);
    const res = await fetch(`/api/tierlists/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/tierlists");
      router.refresh();
      return;
    }
    setDeleting(false);
  }

  useEffect(() => {
    setName(initialName);
    setPlayerId(initialPlayerId ?? "");
    setData(initialData);
  }, [initialName, initialPlayerId, initialData]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = window.setTimeout(() => setSavedFlash(false), 1800);
    return () => window.clearTimeout(t);
  }, [savedFlash]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selected || e.metaKey || e.ctrlKey || e.altKey) return;

      const tierIndex = Number(e.key);
      if (tierIndex >= 1 && tierIndex <= data.tiers.length) {
        const tier = data.tiers[tierIndex - 1];
        e.preventDefault();
        moveToTier(
          selected,
          tier.id,
          placed.has(selected) ? findTierId(data, selected) ?? "pool" : "pool",
        );
      }

      if (e.key === "Escape") setSelected(null);
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        removeToPool(selected);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, moveToTier, removeToPool, placed, data]);

  const iconClass = `rounded-lg border object-cover transition-transform`;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row lg:gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/tierlists" className="link-accent shrink-0">
            ← Tierlists
          </Link>
          <label className="flex shrink-0 flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
              Player
            </span>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="max-w-[12rem] text-sm"
              aria-label="Assign to player"
            >
              <option value="">Unassigned</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} · {formatTeamRole(p.teamRole)}
                </option>
              ))}
            </select>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
            aria-label="Tierlist name"
          />
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{totalPlaced} placed</span>
            {dirty && !savedFlash && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">
                Unsaved
              </span>
            )}
            {savedFlash && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                Saved
              </span>
            )}
          </div>
          {saveError && (
            <p className="w-full text-xs text-rose-400">{saveError}</p>
          )}
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={save}
            disabled={saving || deleting || !dirty}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn-ghost flex shrink-0 items-center gap-1 text-rose-300"
            onClick={() => void deleteTierlist()}
            disabled={saving || deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] text-muted">
              {data.tiers.length} tiers
            </p>
            <button
              type="button"
              className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs"
              onClick={addTier}
              disabled={saving || deleting || data.tiers.length >= 12}
              title="Add a new tier row"
            >
              <Plus className="h-3.5 w-3.5" />
              Add tier
            </button>
          </div>
          {data.tiers.map((tier, index) => {
            const style = tierRowStyle(index);
            const isDrop =
              dropTarget?.kind === "tier" && dropTarget.tierId === tier.id;
            const champions = data.rows[tier.id] ?? [];
            return (
              <div
                key={tier.id}
                className={`flex min-h-[52px] items-stretch gap-2 rounded-lg border transition-shadow ${style.bar} ${
                  isDrop ? `ring-2 ${style.drop}` : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  // Dropping on the row chrome appends (unless a champ sets a finer index).
                  if (
                    !(e.target as HTMLElement).closest("[data-tier-champ]")
                  ) {
                    setDropTarget({
                      kind: "tier",
                      tierId: tier.id,
                      index: champions.length,
                    });
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropTarget((t) =>
                      t?.kind === "tier" && t.tierId === tier.id ? null : t,
                    );
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (
                    dropTarget?.kind === "tier" &&
                    dropTarget.tierId === tier.id
                  ) {
                    handleDrop(dropTarget);
                  } else {
                    handleDrop({
                      kind: "tier",
                      tierId: tier.id,
                      index: champions.length,
                    });
                  }
                }}
              >
                <div
                  className={`flex w-32 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-white/[0.06] px-2 py-1 ${style.label}`}
                >
                  <input
                    value={tier.label}
                    onChange={(e) => renameTier(tier.id, e.target.value)}
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim();
                      renameTier(tier.id, trimmed || `Tier ${index + 1}`);
                    }}
                    onClick={(e) => {
                      if (selected) {
                        e.preventDefault();
                        moveToTier(
                          selected,
                          tier.id,
                          placed.has(selected)
                            ? findTierId(data, selected) ?? "pool"
                            : "pool",
                        );
                      }
                    }}
                    className={`w-full min-w-0 bg-transparent text-center font-bold outline-none placeholder:text-current/40 ${
                      tier.label.length > 20 ? "text-[11px]" : "text-sm"
                    }`}
                    aria-label={`Tier ${index + 1} name`}
                    maxLength={32}
                    title="Rename tier · click while champion selected to place"
                  />
                  <span className="text-[9px] font-normal opacity-50">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTier(tier.id)}
                    disabled={data.tiers.length <= 1}
                    className="rounded p-0.5 opacity-60 transition hover:bg-black/20 hover:opacity-100 disabled:pointer-events-none disabled:opacity-20"
                    title={
                      champions.length > 0
                        ? "Remove tier (champions return to pool)"
                        : "Remove tier"
                    }
                    aria-label={`Remove tier ${tier.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1.5 pr-2">
                  {champions.length === 0 ? (
                    <span className="px-1 text-xs text-muted/60">
                      {selected
                        ? "Click tier name or drop here"
                        : "Drop champions here"}
                    </span>
                  ) : (
                    champions.map((champion, champIndex) => {
                      const insertHere =
                        dropTarget?.kind === "tier" &&
                        dropTarget.tierId === tier.id &&
                        dropTarget.index === champIndex &&
                        dragging?.champion !== champion;
                      return (
                        <button
                          key={champion}
                          type="button"
                          data-tier-champ
                          draggable
                          onDragStart={() =>
                            setDragging({ champion, from: tier.id })
                          }
                          onDragEnd={() => {
                            setDragging(null);
                            setDropTarget(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (
                              e.currentTarget as HTMLElement
                            ).getBoundingClientRect();
                            const mid = rect.left + rect.width / 2;
                            const index =
                              e.clientX < mid ? champIndex : champIndex + 1;
                            setDropTarget({
                              kind: "tier",
                              tierId: tier.id,
                              index,
                            });
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (
                              e.currentTarget as HTMLElement
                            ).getBoundingClientRect();
                            const mid = rect.left + rect.width / 2;
                            const index =
                              e.clientX < mid ? champIndex : champIndex + 1;
                            handleDrop({
                              kind: "tier",
                              tierId: tier.id,
                              index,
                            });
                          }}
                          onClick={() =>
                            setSelected((s) =>
                              s === champion ? null : champion,
                            )
                          }
                          onDoubleClick={() => removeToPool(champion)}
                          title={`${champion} · drag to reorder · double-click to remove`}
                          className={`${iconClass} ${
                            selected === champion
                              ? "scale-105 border-accent-bright ring-2 ring-accent-bright/60"
                              : "border-white/10 hover:border-white/25"
                          } ${
                            insertHere
                              ? "ring-2 ring-accent-bright/50"
                              : ""
                          } ${
                            dragging?.champion === champion
                              ? "opacity-40"
                              : ""
                          }`}
                          style={{ width: iconSize, height: iconSize }}
                        >
                          <img
                            src={championImageUrl(champion)}
                            alt={champion}
                            className="h-full w-full rounded-[inherit] object-cover"
                            draggable={false}
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted">
          Rename tiers in the left column · drag champions to reorder within a
          tier or move between rows · number keys place selected champion ·
          double-click or Delete to remove
        </p>
      </div>

      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-inset/20 lg:w-[280px] xl:w-[320px]">
        <div className="space-y-2 border-b border-border p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search champions…"
            className="w-full text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {ROLE_TABS.map(({ id: role, label }) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleTab((r) => (r === role ? null : role))}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  roleTab === role
                    ? "bg-accent/20 text-accent-bright"
                    : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">{pool.length} available</span>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-sm"
                onClick={() => setIconSize((s) => Math.max(28, s - 4))}
                aria-label="Smaller icons"
              >
                −
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-sm"
                onClick={() => setIconSize((s) => Math.min(56, s + 4))}
                aria-label="Larger icons"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div
          className={`min-h-[240px] flex-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-12rem)] ${
            dropTarget?.kind === "pool" ? "ring-2 ring-inset ring-white/20" : ""
          }`}
          onDragOver={(e) => {
            if (dragging?.from !== "pool") {
              e.preventDefault();
              setDropTarget({ kind: "pool" });
            }
          }}
          onDragLeave={() =>
            setDropTarget((t) => (t?.kind === "pool" ? null : t))
          }
          onDrop={(e) => {
            e.preventDefault();
            handleDrop({ kind: "pool" });
          }}
        >
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${iconSize}px, 1fr))`,
            }}
          >
            {pool.map((champion) => (
              <button
                key={champion}
                type="button"
                draggable
                onDragStart={() => setDragging({ champion, from: "pool" })}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                onClick={() => setSelected((s) => (s === champion ? null : champion))}
                title={champion}
                className={`${iconClass} ${
                  selected === champion
                    ? "scale-105 border-accent-bright ring-2 ring-accent-bright/60"
                    : "border-white/10 hover:border-white/25"
                }`}
                style={{ width: iconSize, height: iconSize }}
              >
                <img
                  src={championImageUrl(champion)}
                  alt={champion}
                  className="h-full w-full rounded-[inherit] object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
          {pool.length === 0 && (
            <p className="py-8 text-center text-xs text-muted">
              No champions match your filters
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export function NewTierlistForm({
  players,
  defaultPlayerId,
}: {
  players: TierlistPlayerOption[];
  defaultPlayerId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState(defaultPlayerId ?? players[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim() || !playerId) return;
    setLoading(true);
    const res = await fetch("/api/tierlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rows: emptyTierlistData(), playerId }),
    });
    setLoading(false);
    if (res.ok) {
      const t = await res.json();
      setOpen(false);
      setName("");
      router.push(`/tierlists/${t.id}`);
      router.refresh();
    }
  }

  if (!players.length) {
    return (
      <p className="text-xs text-muted">Add players to the roster before creating tierlists.</p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + New tierlist
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        className="min-w-[10rem] text-sm"
        aria-label="Player"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tierlist name"
        onKeyDown={(e) => e.key === "Enter" && create()}
        autoFocus
      />
      <button
        type="button"
        className="btn-primary"
        onClick={create}
        disabled={loading || !playerId}
      >
        Create
      </button>
      <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
