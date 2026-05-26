"use client";

import { useMemo, useState } from "react";
import { CHAMPIONS, championImageUrl } from "@/lib/champions";

type Side = "blue" | "red";
type Action = "pick" | "ban";

const SLOTS = { pick: 5, ban: 5 } as const;

export function DrafterTool() {
  const [search, setSearch] = useState("");
  const [activeSide, setActiveSide] = useState<Side>("blue");
  const [activeAction, setActiveAction] = useState<Action>("ban");
  const [bluePicks, setBluePicks] = useState<string[]>([]);
  const [blueBans, setBlueBans] = useState<string[]>([]);
  const [redPicks, setRedPicks] = useState<string[]>([]);
  const [redBans, setRedBans] = useState<string[]>([]);
  const [draftName, setDraftName] = useState("Practice Draft");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const used = useMemo(
    () => new Set([...bluePicks, ...blueBans, ...redPicks, ...redBans]),
    [bluePicks, blueBans, redPicks, redBans],
  );

  const filtered = useMemo(
    () =>
      CHAMPIONS.filter(
        (c) =>
          !used.has(c) &&
          c.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, used],
  );

  function getLists(side: Side, action: Action) {
    if (side === "blue") return action === "pick" ? bluePicks : blueBans;
    return action === "pick" ? redPicks : redBans;
  }

  function setLists(side: Side, action: Action, next: string[]) {
    if (side === "blue") {
      if (action === "pick") setBluePicks(next);
      else setBlueBans(next);
    } else {
      if (action === "pick") setRedPicks(next);
      else setRedBans(next);
    }
  }

  function addChampion(champion: string) {
    const list = getLists(activeSide, activeAction);
    if (list.length >= SLOTS[activeAction]) return;
    setLists(activeSide, activeAction, [...list, champion]);
  }

  function removeChampion(side: Side, action: Action, index: number) {
    const list = [...getLists(side, action)];
    list.splice(index, 1);
    setLists(side, action, list);
  }

  function reset() {
    setBluePicks([]);
    setBlueBans([]);
    setRedPicks([]);
    setRedBans([]);
    setMessage("");
  }

  async function saveDraft() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draftName,
        bluePicks,
        blueBans,
        redPicks,
        redBans,
      }),
    });
    setSaving(false);
    setMessage(res.ok ? "Draft saved!" : "Failed to save");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["blue", "red"] as Side[]).map((side) => (
          <button
            key={side}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm capitalize ${activeSide === side ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveSide(side)}
          >
            {side} side
          </button>
        ))}
        {(["ban", "pick"] as Action[]).map((action) => (
          <button
            key={action}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm capitalize ${activeAction === action ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveAction(action)}
          >
            {action}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DraftBoard
          title="Blue"
          color="border-blue-500/40"
          picks={bluePicks}
          bans={blueBans}
          onRemove={(action, i) => removeChampion("blue", action, i)}
        />
        <DraftBoard
          title="Red"
          color="border-red-500/40"
          picks={redPicks}
          bans={redBans}
          onRemove={(action, i) => removeChampion("red", action, i)}
        />
      </div>

      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champions…"
          className="mb-3 w-full max-w-md"
        />
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
          {filtered.slice(0, 48).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => addChampion(c)}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-inset/50 p-2 transition-colors hover:border-accent/40 hover:bg-accent/5"
              title={c}
            >
              <img src={championImageUrl(c)} alt="" className="champion-icon" />
              <span className="truncate text-[10px] text-muted">{c}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="max-w-xs"
          placeholder="Draft name"
        />
        <button type="button" className="btn-primary" onClick={saveDraft} disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button type="button" className="btn-ghost" onClick={reset}>
          Reset board
        </button>
        {message && <span className="text-sm text-emerald-400">{message}</span>}
      </div>
    </div>
  );
}

function DraftBoard({
  title,
  color,
  picks,
  bans,
  onRemove,
}: {
  title: string;
  color: string;
  picks: string[];
  bans: string[];
  onRemove: (action: Action, index: number) => void;
}) {
  return (
    <div className={`rounded-2xl border-2 ${color} bg-inset/80 p-4`}>
      <h3 className="mb-3 font-bold text-foreground">{title}</h3>
      <SlotRow label="Bans" champs={bans} onRemove={(i) => onRemove("ban", i)} />
      <SlotRow label="Picks" champs={picks} onRemove={(i) => onRemove("pick", i)} />
    </div>
  );
}

function SlotRow({
  label,
  champs,
  onRemove,
}: {
  label: string;
  champs: string[];
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-xs uppercase text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const c = champs[i];
          return (
            <div
              key={i}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-border bg-background"
            >
              {c ? (
                <button type="button" onClick={() => onRemove(i)} title="Remove">
                  <img src={championImageUrl(c)} alt={c} className="champion-icon" />
                </button>
              ) : (
                <span className="text-faint">+</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
