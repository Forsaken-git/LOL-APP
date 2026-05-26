"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { MatchScoreboardData } from "@/lib/match-scoreboard";
import { MatchDetailModal } from "./MatchDetailModal";

export type MatchListItem = {
  id: string;
  playedAt: string;
  league: string;
  opponent: string | null;
  result: "WIN" | "LOSS";
  side: "BLUE" | "RED";
  gameType: string;
  scoreboard: MatchScoreboardData;
};

export function MatchesList({ matches }: { matches: MatchListItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openMatch = matches.find((m) => m.id === openId);

  return (
    <>
      <div className="space-y-4">
        {matches.map((m) => (
          <Card key={m.id}>
            <button
              type="button"
              onClick={() => setOpenId(m.id)}
              className="w-full text-left transition-opacity hover:opacity-90"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      vs {m.opponent ?? "Unknown"}
                    </h3>
                    <Badge variant={m.result === "WIN" ? "win" : "loss"}>
                      {m.result}
                    </Badge>
                    <Badge variant={m.side === "BLUE" ? "blue" : "red"}>
                      {m.side}
                    </Badge>
                    <span className="text-xs text-faint">{m.gameType}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {m.league} · {format(new Date(m.playedAt), "PPP")}
                  </p>
                  <p className="mt-2 text-xs text-faint">Click for scoreboard</p>
                </div>
              </div>
            </button>
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
