"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime24 } from "@/lib/datetime";
import { Card } from "@/components/ui/Card";
import type { MatchScoreboardData } from "@/lib/match-scoreboard";
import { MatchDetailModal } from "./MatchDetailModal";

export type MatchListItem = {
  id: string;
  playedAt: string;
  league: string;
  opponent: string | null;
  result: "WIN" | "LOSS" | null;
  status?: "SCHEDULED" | "PLAYED";
  side: "BLUE" | "RED";
  gameType: string;
  scoreboard: MatchScoreboardData;
};

type MatchSession = {
  id: string;
  opponent: string | null;
  league: string;
  startedAt: string;
  matches: MatchListItem[];
  wins: number;
  losses: number;
};

const SESSION_GAP_MS = 4 * 60 * 60 * 1000;

function sameSession(a: MatchListItem, b: MatchListItem): boolean {
  if ((a.opponent ?? "").trim().toLowerCase() !== (b.opponent ?? "").trim().toLowerCase()) {
    return false;
  }
  if (a.league.trim().toLowerCase() !== b.league.trim().toLowerCase()) return false;
  const aTs = new Date(a.playedAt).getTime();
  const bTs = new Date(b.playedAt).getTime();
  return Math.abs(aTs - bTs) <= SESSION_GAP_MS;
}

function buildSessions(matches: MatchListItem[]): MatchSession[] {
  const sessions: MatchSession[] = [];
  let current: MatchSession | null = null;
  for (const match of matches) {
    if (!current || !sameSession(current.matches[current.matches.length - 1], match)) {
      current = {
        id: `session-${match.id}`,
        opponent: match.opponent,
        league: match.league,
        startedAt: match.playedAt,
        matches: [match],
        wins: match.result === "WIN" ? 1 : 0,
        losses: match.result === "LOSS" ? 1 : 0,
      };
      sessions.push(current);
      continue;
    }
    current.matches.push(match);
    if (match.result === "WIN") current.wins += 1;
    if (match.result === "LOSS") current.losses += 1;
  }
  return sessions;
}

export function MatchesList({ matches }: { matches: MatchListItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openMatch = matches.find((m) => m.id === openId);
  const sessions = buildSessions(matches);
  const [openSessions, setOpenSessions] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleSession(sessionId: string) {
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  return (
    <>
      <div className="space-y-4">
        {sessions.map((session) => (
          <Card key={session.id}>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => toggleSession(session.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-faint">Session</p>
                  <h3 className="text-base font-semibold text-foreground">
                    vs {session.opponent ?? "Unknown"}
                  </h3>
                  <p className="text-xs text-muted">
                    {session.league} · {formatDateTime24(new Date(session.startedAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={session.wins >= session.losses ? "win" : "loss"}>
                    {session.wins}-{session.losses}
                  </Badge>
                  <span className="text-xs text-faint">{session.matches.length} games</span>
                  <span className="text-xs text-faint">
                    {openSessions.has(session.id) ? "Hide" : "Show"}
                  </span>
                </div>
              </button>

              {openSessions.has(session.id) && (
                <div className="space-y-2">
                  {session.matches.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setOpenId(m.id)}
                      className="w-full rounded-lg border border-border/60 bg-inset/20 p-3 text-left transition-opacity hover:opacity-90"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              Game {session.matches.length - idx}
                            </p>
                            {m.result ? (
                              <Badge variant={m.result === "WIN" ? "win" : "loss"}>
                                {m.result}
                              </Badge>
                            ) : (
                              <Badge variant="default">Upcoming</Badge>
                            )}
                            <Badge variant={m.side === "BLUE" ? "blue" : "red"}>
                              {m.side}
                            </Badge>
                            <span className="text-xs text-faint">{m.gameType}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {formatDateTime24(new Date(m.playedAt))}
                          </p>
                          <p className="mt-1 text-[11px] text-faint">Click for scoreboard</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <MatchDetailModal
        matchId={openId}
        initialData={openMatch?.scoreboard}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
