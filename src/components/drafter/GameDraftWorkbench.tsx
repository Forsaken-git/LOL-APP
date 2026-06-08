"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime24Compact } from "@/lib/datetime";
import { Trash2 } from "lucide-react";
import { CHAMPIONS, championImageKey, championImageUrl } from "@/lib/champions";
import {
  DRAFT_TURNS,
  isDraftComplete,
  type DraftEntry,
} from "@/lib/draft";

export type DraftRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type DraftRoleTab = DraftRole | null;

export type ChampionRoleData = {
  roleCountsByChampion: Record<string, Record<DraftRole, number>>;
  primaryRoleByChampion: Record<string, DraftRole | null>;
  totalByChampion: Record<string, number>;
};

export type SerializedDraft = {
  id: string;
  title: string;
  opponent: string | null;
  league: string;
  scheduledAt: string;
  ourSide: "BLUE" | "RED";
  status: string;
  notes: string | null;
  matchId?: string | null;
  draftMode?: "CLASSIC" | "FEARLESS";
  entries: DraftEntry[];
  progress: number;
  complete: boolean;
};

function parseDraftMeta(notes: string | null | undefined): {
  mode: "CLASSIC" | "FEARLESS";
  games: number;
  teamBlue: string;
  teamRed: string;
} {
  const raw = notes ?? "";
  const read = (key: string) =>
    raw
      .split(/\r?\n/)
      .find((line) => line.toLowerCase().startsWith(`${key.toLowerCase()}:`))
      ?.slice(key.length + 1)
      ?.trim() ?? "";

  const modeRaw = read("draft-mode");
  const gamesRaw = read("draft-games");
  const mode = modeRaw.toUpperCase() === "FEARLESS" ? "FEARLESS" : "CLASSIC";
  const games = Math.max(1, Math.min(5, Number(gamesRaw || 1)));
  const teamBlue = read("draft-team-blue") || "Team 1";
  const teamRed = read("draft-team-red") || "Team 2";
  return { mode, games, teamBlue, teamRed };
}

function buildDraftNotes(
  mode: "CLASSIC" | "FEARLESS",
  games: number,
  teamBlue: string,
  teamRed: string,
): string {
  const safeGames = Math.max(1, Math.min(5, games));
  return [
    `draft-mode:${mode}`,
    `draft-games:${safeGames}`,
    `draft-team-blue:${teamBlue.trim() || "Team 1"}`,
    `draft-team-red:${teamRed.trim() || "Team 2"}`,
  ].join("\n");
}

function normalizeOpponent(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function GameDraftWorkbench({
  initialDrafts,
  championRoleData,
}: {
  initialDrafts: SerializedDraft[];
  championRoleData: ChampionRoleData;
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDrafts[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [showDraftList, setShowDraftList] = useState(false);

  const selected = drafts.find((d) => d.id === selectedId) ?? null;

  async function handleCreated(draft: SerializedDraft) {
    setDrafts((prev) => [draft, ...prev.filter((d) => d.id !== draft.id)]);
    setSelectedId(draft.id);
    setCreating(false);
    setShowDraftList(false);
  }

  function handleUpdated(draft: SerializedDraft) {
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
  }

  async function handleDeleted(id: string) {
    await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    setSelectedId(next[0]?.id ?? null);
  }

  if (creating) {
    return (
      <div className="space-y-3">
        <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>
          Back to drafts
        </button>
        <CreateDraftForm onCancel={() => setCreating(false)} onCreated={handleCreated} />
      </div>
    );
  }

  if (selected && !showDraftList) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => setShowDraftList(true)}>
            Draft list
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
            }}
          >
            + New game draft
          </button>
        </div>
        <DraftEditor
          draft={selected}
          onUpdated={handleUpdated}
          onDeleted={() => void handleDeleted(selected.id)}
          championRoleData={championRoleData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          setCreating(true);
          setSelectedId(null);
        }}
      >
        + New game draft
      </button>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(d.id);
                setCreating(false);
                setShowDraftList(false);
              }}
              className="w-full rounded-xl border border-border bg-inset/60 px-3 py-2.5 text-left text-sm transition-colors hover:border-border-strong"
            >
              <p className="font-medium text-foreground">{d.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {formatDateTime24Compact(new Date(d.scheduledAt))} · {d.progress}/{DRAFT_TURNS.length}
              </p>
              <p className="mt-1 text-[10px] capitalize text-faint">
                {d.status.toLowerCase()}
                {d.complete ? " · complete" : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateDraftForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (draft: SerializedDraft) => void;
}) {
  const [teamBlue, setTeamBlue] = useState("Team 1");
  const [teamRed, setTeamRed] = useState("Team 2");
  const [ourSide, setOurSide] = useState<"BLUE" | "RED">("BLUE");
  const [draftMode, setDraftMode] = useState<"CLASSIC" | "FEARLESS">("CLASSIC");
  const [games, setGames] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${teamBlue.trim() || "Team 1"} vs ${teamRed.trim() || "Team 2"}`,
        opponent: (ourSide === "BLUE" ? teamRed : teamBlue).trim() || null,
        league: "Linked game",
        ourSide,
        scheduledAt: new Date().toISOString(),
        notes: buildDraftNotes(draftMode, games, teamBlue, teamRed),
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError("Could not create draft");
      return;
    }

    onCreated((await res.json()) as SerializedDraft);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-inset/50 p-5 space-y-4"
    >
      <h3 className="text-lg font-bold text-foreground">New game draft</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Team 1 (Blue side)
          <input
            className="mt-1 w-full"
            value={teamBlue}
            onChange={(e) => setTeamBlue(e.target.value)}
            placeholder="Team 1"
          />
        </label>
        <label className="block text-xs text-muted">
          Team 2 (Red side)
          <input
            className="mt-1 w-full"
            value={teamRed}
            onChange={(e) => setTeamRed(e.target.value)}
            placeholder="Team 2"
          />
        </label>
        <label className="block text-xs text-muted">
          Our side
          <div className="mt-1 flex gap-1.5">
            {(["BLUE", "RED"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setOurSide(side)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  ourSide === side
                    ? side === "BLUE"
                      ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
                      : "border-rose-400/60 bg-rose-500/15 text-rose-200"
                    : "border-border bg-inset/40 text-muted hover:text-foreground"
                }`}
                aria-pressed={ourSide === side}
              >
                {side}
              </button>
            ))}
          </div>
        </label>
        <label className="block text-xs text-muted">
          Draft mode
          <div className="mt-1 flex gap-1.5">
            {(["CLASSIC", "FEARLESS"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDraftMode(mode)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  draftMode === mode
                    ? mode === "FEARLESS"
                      ? "border-amber-400/60 bg-amber-500/15 text-amber-200"
                      : "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                    : "border-border bg-inset/40 text-muted hover:text-foreground"
                }`}
                aria-pressed={draftMode === mode}
              >
                {mode === "CLASSIC" ? "Normal" : "Fearless"}
              </button>
            ))}
          </div>
        </label>
        <div className="block text-xs text-muted">
          Number of games
          <div className="mt-1 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGames(n)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  games === n
                    ? "border-accent-bright bg-accent/15 text-accent-bright"
                    : "border-border bg-inset/40 text-muted hover:text-foreground"
                }`}
                aria-pressed={games === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Creating…" : "Start draft"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DraftEditor({
  draft,
  onUpdated,
  onDeleted,
  championRoleData,
}: {
  draft: SerializedDraft;
  onUpdated: (draft: SerializedDraft) => void;
  onDeleted: () => void;
  championRoleData: ChampionRoleData;
}) {
  const [entries, setEntries] = useState<DraftEntry[]>(draft.entries);
  const [pendingChampion, setPendingChampion] = useState<string | null>(null);
  const [roleTab, setRoleTab] = useState<DraftRoleTab>(null);
  const [search, setSearch] = useState("");
  const [iconSize, setIconSize] = useState(40);
  const [selectedMatchId, setSelectedMatchId] = useState(draft.matchId ?? "");
  const [matchOptions, setMatchOptions] = useState<
    Array<{
      id: string;
      playedAt: string;
      league: string;
      opponent: string | null;
      side: "BLUE" | "RED";
      result: "WIN" | "LOSS" | null;
      linkedDraftId: string | null;
      championPool: string[];
    }>
  >([]);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEntries(draft.entries);
    setPendingChampion(null);
  }, [draft.id, draft.entries]);

  useEffect(() => {
    setSelectedMatchId(draft.matchId ?? "");
  }, [draft.id, draft.matchId]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const res = await fetch("/api/matches");
      if (!res.ok) return;
      const rows = (await res.json()) as Array<{
        id: string;
        playedAt: string;
        league: string;
        opponent: string | null;
        side: "BLUE" | "RED";
        result: "WIN" | "LOSS" | null;
        linkedDraftId: string | null;
        championPool: string[];
      }>;
      if (mounted) setMatchOptions(rows);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const nextTurnIndex = entries.length;
  const complete = isDraftComplete(entries);
  const activeTurn = DRAFT_TURNS[nextTurnIndex];

  const unavailableChampionKeys = useMemo(
    () => new Set(entries.map((e) => championImageKey(e.champion))),
    [entries],
  );
  const draftMeta = useMemo(() => parseDraftMeta(draft.notes), [draft.notes]);
  const draftMode = draftMeta.mode;

  const fearlessLockedChampionKeys = useMemo(() => {
    if (draftMode !== "FEARLESS") return new Set<string>();
    const sameLeague = (draft.league ?? "").trim().toLowerCase();
    const sameOpponent = normalizeOpponent(draft.opponent);
    const keys = new Set<string>();
    for (const m of matchOptions) {
      if (draft.matchId && m.id === draft.matchId) continue;
      if ((m.league ?? "").trim().toLowerCase() !== sameLeague) continue;
      if (normalizeOpponent(m.opponent) !== sameOpponent) continue;
      for (const c of m.championPool ?? []) {
        keys.add(championImageKey(c));
      }
    }
    return keys;
  }, [draft.league, draft.matchId, draft.opponent, draftMode, matchOptions]);

  const allUnavailableChampionKeys = useMemo(() => {
    const merged = new Set(unavailableChampionKeys);
    for (const k of fearlessLockedChampionKeys) merged.add(k);
    return merged;
  }, [fearlessLockedChampionKeys, unavailableChampionKeys]);

  const blueBans = getSideSlots(entries, "BLUE", "BAN");
  const bluePicks = getSideSlots(entries, "BLUE", "PICK");
  const redBans = getSideSlots(entries, "RED", "BAN");
  const redPicks = getSideSlots(entries, "RED", "PICK");

  const activeSlotMeta = useMemo(() => {
    if (!activeTurn || complete) return null;
    if (activeTurn.type === "BAN") {
      const filled = entries.filter(
        (e) => e.side === activeTurn.side && e.type === "BAN",
      ).length;
      const code = activeTurn.side === "BLUE" ? `B${filled + 1}` : `R${filled + 1}`;
      return { type: "BAN" as const, index: filled, code };
    }

    const filled = entries.filter(
      (e) => e.side === activeTurn.side && e.type === "PICK",
    ).length;
    const code = activeTurn.side === "BLUE" ? `B${filled + 1}` : `R${filled + 1}`;
    return { type: "PICK" as const, index: filled, code };
  }, [activeTurn, complete, entries]);

  const undoLast = useCallback(() => {
    if (entries.length === 0) return;
    const updated = entries.slice(0, -1);
    setEntries(updated);
    setPendingChampion(null);
    void persist(updated);
  }, [entries]);

  const resetDraft = useCallback(() => {
    const updated: DraftEntry[] = [];
    setEntries(updated);
    setPendingChampion(null);
    void persist(updated);
  }, [draft.id]);

  const persist = useCallback(
    (next: DraftEntry[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/drafts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: next }),
        });
        setSaving(false);
        if (res.ok) onUpdated((await res.json()) as SerializedDraft);
      }, 250);
    },
    [draft.id, onUpdated],
  );

  const removeChampion = useCallback(
    (champion: string) => {
      const filtered = entries.filter((e) => e.champion !== champion);
      if (filtered.length === entries.length) return;
      const updated = filtered.map((e, i) => ({ ...e, order: i }));
      setEntries(updated);
      persist(updated);
    },
    [entries, persist],
  );

  const selectChampion = useCallback(
    (champion: string) => {
      if (complete || !activeTurn) return;
      if (allUnavailableChampionKeys.has(championImageKey(champion))) return;
      setPendingChampion((prev) => (prev === champion ? null : champion));
    },
    [activeTurn, allUnavailableChampionKeys, complete],
  );

  const confirmSelection = useCallback(() => {
    if (complete || !activeTurn || !pendingChampion) return;
    const championKey = championImageKey(pendingChampion);
    if (allUnavailableChampionKeys.has(championKey)) return;

    const next: DraftEntry = {
      champion: pendingChampion,
      type: activeTurn.type,
      side: activeTurn.side,
      order: entries.length,
    };
    const updated = [...entries, next];
    setEntries(updated);
    setPendingChampion(null);
    persist(updated);
  }, [
    activeTurn,
    allUnavailableChampionKeys,
    complete,
    entries,
    pendingChampion,
    persist,
  ]);

  const confirmLabel = useMemo(() => {
    if (complete) return "Draft complete";
    if (!activeTurn) return "Confirm";
    if (!pendingChampion) {
      return activeTurn.type === "BAN" ? "Select a champion to ban" : "Select a champion to pick";
    }
    const side = activeTurn.side === "BLUE" ? "Blue" : "Red";
    const action = activeTurn.type === "BAN" ? "Ban" : "Pick";
    return `Confirm ${action} — ${pendingChampion} (${side})`;
  }, [activeTurn, complete, pendingChampion]);

  const filteredChampions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return CHAMPIONS.filter((c) => {
      if (allUnavailableChampionKeys.has(championImageKey(c))) return false;
      if (roleTab && championRoleData.primaryRoleByChampion[c] !== roleTab) {
        return false;
      }
      if (!query) return true;
      return c.toLowerCase().includes(query);
    });
  }, [allUnavailableChampionKeys, championRoleData.primaryRoleByChampion, roleTab, search]);

  const availableMatches = useMemo(
    () =>
      matchOptions.filter(
        (m) => m.linkedDraftId == null || m.linkedDraftId === draft.id || m.id === draft.matchId,
      ),
    [draft.id, draft.matchId, matchOptions],
  );

  const linkDraftToMatch = useCallback(async () => {
    setLinking(true);
    setLinkError("");
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: selectedMatchId || null }),
    });
    setLinking(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setLinkError(body?.error ?? "Could not link draft to match");
      return;
    }
    onUpdated((await res.json()) as SerializedDraft);
  }, [draft.id, onUpdated, selectedMatchId]);

  const saveDraftNow = useCallback(async () => {
    setSaving(true);
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setSaving(false);
    if (res.ok) onUpdated((await res.json()) as SerializedDraft);
  }, [draft.id, entries, onUpdated]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Navigation</p>
          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground">
            Waiting for drafter
          </h3>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn-ghost flex items-center gap-1 text-rose-300"
            onClick={onDeleted}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="w-[22rem] max-w-full"
          >
            <option value="">No linked match</option>
            {availableMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {formatDateTime24Compact(new Date(m.playedAt))} · {m.league} · vs{" "}
                {m.opponent ?? "TBD"} · {m.side}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void saveDraftNow()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void linkDraftToMatch()}
            disabled={linking}
          >
            {linking ? "Linking..." : "Link match"}
          </button>
        </div>
        {linkError && <p className="text-center text-sm text-rose-400">{linkError}</p>}
      </div>

      <div className="grid min-h-[calc(100vh-13rem)] gap-3 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <TeamDraftColumn
          side="BLUE"
          bans={blueBans}
          picks={bluePicks}
          activeSlotMeta={activeSlotMeta}
          onRemoveChampion={removeChampion}
          teamName={draftMeta.teamBlue}
        />

        <div className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col space-y-3 rounded-2xl border border-border bg-[#090b10] p-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <p className="text-base font-semibold text-sky-200">{draftMeta.teamBlue}</p>
              <p className="text-[10px] uppercase tracking-wide text-faint">Blue side</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-faint">
                Lobby · Bo{draftMeta.games}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime24Compact(new Date(draft.scheduledAt))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-rose-200">{draftMeta.teamRed}</p>
              <p className="text-[10px] uppercase tracking-wide text-faint">Red side</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <RoleButton
                label="Top"
                active={roleTab === "TOP"}
                onClick={() => setRoleTab((prev) => (prev === "TOP" ? null : "TOP"))}
              />
              <RoleButton
                label="Jng"
                active={roleTab === "JUNGLE"}
                onClick={() => setRoleTab((prev) => (prev === "JUNGLE" ? null : "JUNGLE"))}
              />
              <RoleButton
                label="Mid"
                active={roleTab === "MID"}
                onClick={() => setRoleTab((prev) => (prev === "MID" ? null : "MID"))}
              />
              <RoleButton
                label="ADC"
                active={roleTab === "ADC"}
                onClick={() => setRoleTab((prev) => (prev === "ADC" ? null : "ADC"))}
              />
              <RoleButton
                label="Sup"
                active={roleTab === "SUPPORT"}
                onClick={() => setRoleTab((prev) => (prev === "SUPPORT" ? null : "SUPPORT"))}
              />
            </div>
            <div className="flex items-center gap-2">
              {draftMode === "FEARLESS" && (
                <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  Fearless ({fearlessLockedChampionKeys.size} locked)
                </span>
              )}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-52 rounded-xl border border-border bg-inset px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-sm"
                onClick={() => setIconSize((v) => Math.max(32, v - 4))}
                title="Smaller icons"
              >
                -
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-sm"
                onClick={() => setIconSize((v) => Math.min(56, v + 4))}
                title="Bigger icons"
              >
                +
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14">
              {filteredChampions.map((c) => {
                const selected = pendingChampion === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectChampion(c)}
                    disabled={complete}
                    className="group flex flex-col items-center"
                    title={selected ? `${c} — click again to deselect` : c}
                    aria-pressed={selected}
                  >
                    <img
                      src={championImageUrl(c)}
                      alt={c}
                      className={`rounded-md border bg-inset object-cover transition-colors ${
                        selected
                          ? "border-accent-bright ring-2 ring-accent-bright/60"
                          : "border-border group-hover:border-accent-bright"
                      }`}
                      style={{ width: iconSize, height: iconSize }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={confirmSelection}
              disabled={complete || !pendingChampion}
              className={`mx-auto block min-w-[16rem] max-w-full rounded-xl px-8 py-2.5 text-sm font-semibold transition-colors ${
                pendingChampion && !complete
                  ? "btn-primary"
                  : "cursor-not-allowed border border-white/15 bg-white/[0.04] text-muted"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>

        <TeamDraftColumn
          side="RED"
          bans={redBans}
          picks={redPicks}
          activeSlotMeta={activeSlotMeta}
          onRemoveChampion={removeChampion}
          teamName={draftMeta.teamRed}
        />
      </div>
    </div>
  );
}

function RoleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs ${
        active
          ? "border-accent-bright bg-accent/15 text-accent-bright"
          : "border-border bg-inset/40 text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function TeamDraftColumn({
  side,
  bans,
  picks,
  activeSlotMeta,
  onRemoveChampion,
  teamName,
}: {
  side: "BLUE" | "RED";
  bans: Array<string | null>;
  picks: Array<string | null>;
  activeSlotMeta: null | { type: "BAN" | "PICK"; index: number; code: string };
  onRemoveChampion: (champion: string) => void;
  teamName: string;
}) {
  const activeBanIndex = activeSlotMeta?.type === "BAN" && activeSlotMeta.code.startsWith(side === "BLUE" ? "B" : "R")
    ? activeSlotMeta.index
    : -1;

  const activePickIndex = activeSlotMeta?.type === "PICK" && activeSlotMeta.code.startsWith(side === "BLUE" ? "B" : "R")
    ? activeSlotMeta.index
    : -1;

  const innerLineClass =
    side === "BLUE"
      ? "border-r border-white/20"
      : "border-l border-white/20";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-faint">
        {teamName} ({side})
      </p>
      <div
        className={`grid min-h-0 flex-1 grid-rows-5 gap-2 py-2 ${innerLineClass}`}
      >
        {picks.map((champ, i) => (
          <ChampionStrip
            key={`pick-${side}-${i}`}
            side={side}
            label={(side === "BLUE" ? "B" : "R") + (i + 1)}
            champion={champ}
            active={activePickIndex === i}
              onRemoveChampion={onRemoveChampion}
          />
        ))}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/80 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Bans
        </p>
        <div className="grid grid-cols-5 gap-2">
          {bans.map((champ, i) => (
            <SlotTile
              key={`ban-${side}-${i}`}
              label={(side === "BLUE" ? "B" : "R") + (i + 1)}
              champion={champ}
              active={activeBanIndex === i}
              onRemoveChampion={onRemoveChampion}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChampionStrip({
  side,
  label,
  champion,
  active,
  onRemoveChampion,
}: {
  side: "BLUE" | "RED";
  label: string;
  champion: string | null;
  active: boolean;
  onRemoveChampion: (champion: string) => void;
}) {
  const imagePosition =
    side === "BLUE" ? "object-[88%_18%]" : "object-[12%_18%]";
  return (
    <div
      className={`relative h-full min-h-[90px] overflow-hidden rounded-md border bg-[#0d0f15] ${
        active ? "border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]" : "border-border"
      }`}
      title={champion ? `${champion} (click to remove)` : label}
      onClick={() => {
        if (champion) onRemoveChampion(champion);
      }}
    >
      {champion ? (
        <>
          <img
            src={championSplashUrl(champion)}
            alt={champion}
            className={`absolute inset-0 h-full w-full scale-110 object-cover opacity-90 ${imagePosition}`}
          />
          <div
            className={`absolute inset-0 ${
              side === "BLUE"
                ? "bg-gradient-to-l from-black/50 via-transparent to-black/25"
                : "bg-gradient-to-r from-black/50 via-transparent to-black/25"
            }`}
          />
          <span
            className={`absolute top-1 text-[10px] font-semibold text-white/80 ${
              side === "BLUE" ? "left-2" : "right-2"
            }`}
          >
            {label}
          </span>
          <span
            className={`absolute bottom-1 text-[11px] font-semibold uppercase tracking-wide text-white ${
              side === "BLUE" ? "left-2" : "right-2"
            }`}
          >
            {champion}
          </span>
        </>
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-lg text-white/20">◌</span>
        </div>
      )}
    </div>
  );
}

function SlotTile({
  label,
  champion,
  active,
  onRemoveChampion,
}: {
  label: string;
  champion: string | null;
  active: boolean;
  onRemoveChampion: (champion: string) => void;
}) {
  return (
    <div
      className={`relative flex aspect-square w-full items-center justify-center rounded-md border bg-inset/40 ${
        champion
          ? "border-border-strong"
          : "border-dashed border-border"
      } ${active ? "border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]" : ""}`}
      title={champion ? `${champion} (click to remove)` : label}
      onClick={() => {
        if (champion) onRemoveChampion(champion);
      }}
    >
      {champion ? (
        <img
          src={championImageUrl(champion)}
          alt={champion}
          className="h-full w-full rounded-[6px] object-cover"
        />
      ) : (
        <span className="text-lg text-white/20">◌</span>
      )}
    </div>
  );
}

function getSideSlots(
  entries: DraftEntry[],
  side: "BLUE" | "RED",
  type: "BAN" | "PICK",
): Array<string | null> {
  const champs = entries
    .filter((e) => e.side === side && e.type === type)
    .sort((a, b) => a.order - b.order)
    .map((e) => e.champion);
  const out: Array<string | null> = Array.from({ length: 5 }, () => null);
  for (let i = 0; i < Math.min(5, champs.length); i++) out[i] = champs[i];
  return out;
}

function championSplashUrl(name: string): string {
  const key = championImageKey(name);
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${encodeURIComponent(key)}_0.jpg`;
}

