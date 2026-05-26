"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MatchDetailModal } from "@/components/matches/MatchDetailModal";
import type { EncounterSummary } from "@/lib/match-encounters";

export type SerializedEncounter = Omit<EncounterSummary, "playedAt" | "games"> & {
  playedAt: string;
  games: Array<
    Omit<EncounterSummary["games"][number], "playedAt"> & { playedAt: string }
  >;
};

function deserialize(encounters: SerializedEncounter[]): EncounterSummary[] {
  return encounters.map((e) => ({
    ...e,
    playedAt: new Date(e.playedAt),
    games: e.games.map((g) => ({ ...g, playedAt: new Date(g.playedAt) })),
  }));
}

export function RecentMatches({ encounters }: { encounters: SerializedEncounter[] }) {
  const items = deserialize(encounters);
  const [open, setOpen] = useState<EncounterSummary | null>(null);
  const [scoreboardId, setScoreboardId] = useState<string | null>(null);

  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      <Card
        title="Recent matches"
        action={
          <Link href="/matches" className="link-accent">
            View all →
          </Link>
        }
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted">No matches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">League</th>
                  <th className="pb-2 pr-4 font-medium">Opponent</th>
                  <th className="pb-2 pr-4 font-medium">Result</th>
                  <th className="pb-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr
                    key={e.key}
                    className="table-row cursor-pointer transition-colors hover:bg-white/[0.03]"
                    onClick={() => setOpen(e)}
                  >
                    <td className="py-3 pr-4 text-foreground">
                      {format(e.playedAt, "MMM d")}
                      {e.gameCount > 1 && (
                        <span className="ml-1.5 text-xs text-faint">
                          · {e.gameCount} games
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted">{e.league}</td>
                    <td className="py-3 pr-4 text-muted">{e.opponent ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {e.seriesResult === "DRAW" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <Badge variant={e.seriesResult === "WIN" ? "win" : "loss"}>
                          {e.seriesResult}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 font-medium tabular-nums text-foreground">
                      {e.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Match series"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={close}
            aria-label="Close"
          />
          <div className="relative z-10 flex max-h-[min(85vh,640px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  vs {open.opponent ?? "Unknown"}
                </h2>
                <p className="text-sm text-muted">
                  {open.league} · {format(open.playedAt, "MMMM d, yyyy")}
                </p>
                <p className="mt-1 text-xs text-faint">
                  Series {open.score}
                  {open.seriesResult !== "DRAW" && (
                    <>
                      {" "}
                      ·{" "}
                      <span
                        className={
                          open.seriesResult === "WIN" ? "text-emerald-400" : "text-rose-400"
                        }
                      >
                        {open.seriesResult === "WIN" ? "Win" : "Loss"}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <p className="mb-3 text-xs text-faint">Click a game for the 5v5 scoreboard</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">League</th>
                    <th className="pb-2 pr-3 font-medium">Opponent</th>
                    <th className="pb-2 pr-3 font-medium">Side</th>
                    <th className="pb-2 pr-3 font-medium">Result</th>
                    <th className="pb-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {open.games.map((g) => (
                    <tr
                      key={g.id}
                      className="table-row cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => setScoreboardId(g.id)}
                    >
                      <td className="py-2.5 pr-3 text-foreground">
                        {format(g.playedAt, "MMM d · HH:mm")}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{g.league}</td>
                      <td className="py-2.5 pr-3 text-muted">{g.opponent ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={g.side === "BLUE" ? "blue" : "red"}>
                          {g.side}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={g.result === "WIN" ? "win" : "loss"}>
                          {g.result}
                        </Badge>
                      </td>
                      <td className="py-2.5 font-medium tabular-nums text-foreground">
                        {g.seriesState}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <MatchDetailModal
        matchId={scoreboardId}
        onClose={() => setScoreboardId(null)}
      />
    </>
  );
}
