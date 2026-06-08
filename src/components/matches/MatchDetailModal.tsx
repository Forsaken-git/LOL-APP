"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { MatchScoreboardData } from "@/lib/match-scoreboard";
import { MatchScoreboard } from "./MatchScoreboard";

type EnemyPlayerEdit = {
  participantId: string;
  playerId: string;
  champion: string;
  name: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  cs: number | null;
  damage: number | null;
  goldEarned: number | null;
  visionScore: number | null;
};

export function MatchDetailModal({
  matchId,
  onClose,
  initialData,
}: {
  matchId: string | null;
  onClose: () => void;
  initialData?: MatchScoreboardData | null;
}) {
  const [data, setData] = useState<MatchScoreboardData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEnemy, setSavingEnemy] = useState(false);
  const [showEnemyEditor, setShowEnemyEditor] = useState(false);
  const [enemyPlayers, setEnemyPlayers] = useState<EnemyPlayerEdit[]>([]);
  const [error, setError] = useState("");

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!matchId) {
      setData(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/matches/${matchId}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          scoreboard?: MatchScoreboardData;
          enemyPlayers?: EnemyPlayerEdit[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to load match");
        if (!cancelled && body.scoreboard) {
          setData(body.scoreboard);
          setEnemyPlayers(body.enemyPlayers ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load match");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (!matchId) return null;

  async function removeMatch() {
    if (!matchId || deleting) return;
    const ok = window.confirm("Delete this match? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Failed to delete match");
      close();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete match");
    } finally {
      setDeleting(false);
    }
  }

  async function saveEnemyNames() {
    if (!matchId || savingEnemy) return;
    setSavingEnemy(true);
    setError("");
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enemyPlayers: enemyPlayers.map((p) => ({
            participantId: p.participantId,
            name: p.name,
          })),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        scoreboard?: MatchScoreboardData;
        enemyPlayers?: EnemyPlayerEdit[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "Failed to save enemy names");
      if (body?.scoreboard) setData(body.scoreboard);
      if (body?.enemyPlayers) setEnemyPlayers(body.enemyPlayers);
      setShowEnemyEditor(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save enemy names");
    } finally {
      setSavingEnemy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Match scoreboard"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={close}
        aria-label="Close"
      />
      <div className="relative z-10 flex max-h-[96vh] w-full max-w-[min(98vw,1780px)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0e0f14] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEnemyEditor((v) => !v)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/15"
            >
              {showEnemyEditor ? "Hide enemy names" : "Edit enemy names"}
            </button>
            <Link
              href={`/matches/${matchId}/edit`}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/15"
            >
              Edit match
            </Link>
            <button
              type="button"
              onClick={removeMatch}
              disabled={deleting}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Removing…" : "Remove match"}
            </button>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          {showEnemyEditor && enemyPlayers.length > 0 && (
            <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Enemy quick edits
              </p>
              <div className="space-y-2">
                {enemyPlayers.map((p) => (
                  <div
                    key={p.participantId}
                    className="rounded-lg border border-white/10 bg-white/[0.02] p-2"
                  >
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block text-xs text-muted">
                        Name
                        <input
                          value={p.name}
                          onChange={(e) =>
                            setEnemyPlayers((prev) =>
                              prev.map((x) =>
                                x.participantId === p.participantId
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          placeholder="Enemy name"
                          className="mt-1 w-full"
                        />
                      </label>
                      <label className="block text-xs text-muted">
                        Champion
                        <input
                          value={p.champion}
                          onChange={(e) =>
                            setEnemyPlayers((prev) =>
                              prev.map((x) =>
                                x.participantId === p.participantId
                                  ? { ...x, champion: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          placeholder="Champion"
                          className="mt-1 w-full"
                        />
                      </label>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-7">
                      {(
                        [
                          ["kills", "K"],
                          ["deaths", "D"],
                          ["assists", "A"],
                          ["cs", "CS"],
                          ["damage", "DMG"],
                          ["goldEarned", "Gold"],
                          ["visionScore", "Vis"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block text-[10px] text-muted">
                          {label}
                          <input
                            value={p[key] == null ? "" : String(p[key])}
                            onChange={(e) =>
                              setEnemyPlayers((prev) =>
                                prev.map((x) =>
                                  x.participantId === p.participantId
                                    ? {
                                        ...x,
                                        [key]:
                                          e.target.value.trim() === ""
                                            ? null
                                            : Number(e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                            inputMode="numeric"
                            className="mt-0.5 w-full"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEnemyNames}
                  disabled={savingEnemy}
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  {savingEnemy ? "Saving…" : "Save enemy names"}
                </button>
                <span className="text-[11px] text-faint">
                  Updates this match immediately.
                </span>
              </div>
            </div>
          )}
          {loading && !data && (
            <p className="text-center text-sm text-muted">Loading scoreboard…</p>
          )}
          {error && (
            <p className="text-center text-sm text-rose-400">{error}</p>
          )}
          {data && (
            <>
              {loading && (
                <p className="mb-2 text-center text-xs text-muted">Updating…</p>
              )}
              <MatchScoreboard data={data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
