"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { championImageUrl } from "@/lib/champions";
import { formatTeamRole, rosterLabel } from "@/lib/player-display";
import type { PlayerProfile } from "@/lib/player-profile-types";
import {
  PlayerDetailModal,
  type PlayerTierlistSummary,
} from "./PlayerDetailModal";

export function PlayersRoster({
  players,
  tierlistsByPlayerId,
}: {
  players: PlayerProfile[];
  tierlistsByPlayerId: Record<string, PlayerTierlistSummary[]>;
}) {
  const [selected, setSelected] = useState<PlayerProfile | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      <Card>
        {players.length === 0 ? (
          <p className="text-sm text-muted">No active players on the roster.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="table-head">
                  <th className="pb-3 pr-4 font-medium">Player</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Roster</th>
                  <th className="pb-3 pr-4 font-medium text-right">Games</th>
                  <th className="pb-3 font-medium">Recent champions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const isSub = player.memberRole === "SUB";
                  const { recent } = player;

                  return (
                    <tr
                      key={player.id}
                      className="table-row cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => setSelected(player)}
                    >
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-foreground">
                          {player.displayName}
                        </div>
                        {player.summonerName && (
                          <div className="mt-0.5 text-xs text-muted">
                            {player.summonerName}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 tabular-nums text-muted">
                        {formatTeamRole(player.teamRole)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge variant={isSub ? "default" : "blue"}>
                          {rosterLabel(player.memberRole)}
                        </Badge>
                      </td>
                      <td className="py-3.5 pr-4 text-right tabular-nums text-foreground">
                        {player.totalGames}
                      </td>
                      <td className="py-3.5">
                        {recent.length === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {recent.map((champion) => (
                              <img
                                key={champion}
                                src={championImageUrl(champion)}
                                alt={champion}
                                title={champion}
                                className="h-8 w-8 rounded-md border border-border bg-inset"
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PlayerDetailModal
        player={selected}
        tierlists={selected ? (tierlistsByPlayerId[selected.id] ?? []) : []}
        onClose={close}
      />
    </>
  );
}
