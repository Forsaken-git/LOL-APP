"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { MatchScoreboardData } from "@/lib/match-scoreboard";
import { MatchScoreboard } from "./MatchScoreboard";

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
  const [error, setError] = useState("");

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!matchId) {
      setData(null);
      setError("");
      return;
    }

    if (initialData && initialData.matchId === matchId) {
      setData(initialData);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/matches/${matchId}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          scoreboard?: MatchScoreboardData;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to load match");
        if (!cancelled) setData(body.scoreboard ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load match");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [matchId, initialData]);

  useEffect(() => {
    if (!matchId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [matchId, close]);

  if (!matchId) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
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
      <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        {data && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                vs {data.opponent ?? "Unknown"}
              </h2>
              <p className="text-sm text-muted">
                {data.league} · {format(parseISO(data.playedAt), "PPP · p")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={data.result === "WIN" ? "win" : "loss"}>
                  {data.result}
                </Badge>
                <Badge variant={data.ourSide === "BLUE" ? "blue" : "red"}>
                  Our side · {data.ourSide}
                </Badge>
              </div>
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
        )}

        <div className="overflow-y-auto p-5">
          {loading && (
            <p className="text-center text-sm text-muted">Loading scoreboard…</p>
          )}
          {error && (
            <p className="text-center text-sm text-rose-400">{error}</p>
          )}
          {data && !loading && <MatchScoreboard data={data} />}
        </div>
      </div>
    </div>
  );
}
