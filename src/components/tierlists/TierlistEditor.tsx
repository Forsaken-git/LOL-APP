"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHAMPIONS, championImageUrl } from "@/lib/champions";

const TIERS = ["S", "A", "B", "C", "D"] as const;
type TierRows = Record<(typeof TIERS)[number], string[]>;

export function TierlistEditor({
  id,
  name: initialName,
  initialRows,
}: {
  id: string;
  name: string;
  initialRows: TierRows;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<TierRows>(initialRows);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const placed = new Set(TIERS.flatMap((t) => rows[t]));
  const pool = CHAMPIONS.filter(
    (c) =>
      !placed.has(c) && c.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 24);

  function addToTier(tier: (typeof TIERS)[number], champion: string) {
    setRows((r) => ({
      ...r,
      [tier]: [...r[tier], champion],
    }));
  }

  function removeFromTier(tier: (typeof TIERS)[number], champion: string) {
    setRows((r) => ({
      ...r,
      [tier]: r[tier].filter((c) => c !== champion),
    }));
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/tierlists/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rows }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-sm font-semibold"
        />
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save tierlist"}
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Add champion from pool…"
        className="max-w-md"
      />

      <div className="flex flex-wrap gap-2">
        {pool.map((c) => (
          <div key={c} className="group relative">
            <img src={championImageUrl(c)} alt={c} className="champion-icon" title={c} />
            <div className="absolute -bottom-6 left-0 z-10 hidden gap-0.5 group-hover:flex">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded border border-accent/30 bg-inset px-1 text-[10px] text-accent-bright"
                  onClick={() => addToTier(t, c)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {TIERS.map((tier) => (
        <div
          key={tier}
          className="flex min-h-[56px] items-center gap-2 rounded-xl border border-border bg-inset/30"
        >
          <span className="flex h-full w-10 shrink-0 items-center justify-center bg-accent/15 text-sm font-bold text-accent-bright">
            {tier}
          </span>
          <div className="flex flex-wrap gap-2 py-2">
            {rows[tier].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => removeFromTier(tier, c)}
                title="Click to remove"
              >
                <img src={championImageUrl(c)} alt={c} className="champion-icon" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewTierlistForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    const empty: TierRows = { S: [], A: [], B: [], C: [], D: [] };
    const res = await fetch("/api/tierlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rows: empty }),
    });
    setLoading(false);
    if (res.ok) {
      const t = await res.json();
      setOpen(false);
      router.push(`/tierlists/${t.id}`);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + New tierlist
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tierlist name"
      />
      <button type="button" className="btn-primary" onClick={create} disabled={loading}>
        Create
      </button>
      <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
