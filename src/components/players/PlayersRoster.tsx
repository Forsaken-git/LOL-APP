"use client";

import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { championImageUrl } from "@/lib/champions";
import { formatTeamRole, rosterLabel } from "@/lib/player-display";
import type { PlayerProfile } from "@/lib/player-profile-types";
import {
  PlayerDetailModal,
  type PlayerTierlistSummary,
} from "./PlayerDetailModal";
import { AddPlayerForm } from "./AddPlayerForm";

function PlayerCards({
  players,
  onSelect,
  muted,
}: {
  players: PlayerProfile[];
  onSelect: (player: PlayerProfile) => void;
  muted?: boolean;
}) {
  return (
    <ul className="space-y-2 md:hidden">
      {players.map((player) => {
        const isSub = player.memberRole === "SUB";
        const { recent } = player;

        return (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => onSelect(player)}
              className={`w-full rounded-xl border border-border bg-inset/30 p-3 text-left transition-colors hover:bg-inset/50 ${
                muted ? "opacity-85" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {player.displayName}
                    </span>
                    {!player.active && <Badge variant="default">Former</Badge>}
                  </div>
                  {player.summonerName && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {player.summonerName}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {player.totalGames}
                  </p>
                  <p className="text-[10px] text-faint">games</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">
                  {formatTeamRole(player.teamRole)}
                </span>
                <Badge variant={isSub ? "default" : "blue"}>
                  {rosterLabel(player.memberRole)}
                </Badge>
              </div>
              {recent.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {recent.slice(0, 5).map((champion) => (
                    <img
                      key={champion}
                      src={championImageUrl(champion)}
                      alt={champion}
                      title={champion}
                      className="h-7 w-7 rounded-md border border-border bg-inset"
                    />
                  ))}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PlayerTable({
  players,
  onSelect,
  muted,
}: {
  players: PlayerProfile[];
  onSelect: (player: PlayerProfile) => void;
  muted?: boolean;
}) {
  return (
    <table className="hidden w-full min-w-[720px] text-left text-sm md:table">
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
              className={`table-row cursor-pointer transition-colors hover:bg-white/[0.04] ${
                muted ? "opacity-80" : ""
              }`}
              onClick={() => onSelect(player)}
            >
              <td className="py-3.5 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {player.displayName}
                  </span>
                  {!player.active && <Badge variant="default">Former</Badge>}
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
  );
}

export function PlayersRoster({
  players,
  formerPlayers = [],
  tierlistsByPlayerId,
}: {
  players: PlayerProfile[];
  formerPlayers?: PlayerProfile[];
  tierlistsByPlayerId: Record<string, PlayerTierlistSummary[]>;
}) {
  const [selected, setSelected] = useState<PlayerProfile | null>(null);
  const [showFormer, setShowFormer] = useState(false);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <p className="text-xs text-muted">
            {players.length} active player{players.length === 1 ? "" : "s"}
          </p>
          <AddPlayerForm />
        </div>

        {players.length === 0 ? (
          <p className="text-sm text-muted">No active players on the roster.</p>
        ) : (
          <>
            <PlayerCards players={players} onSelect={setSelected} />
            <div className="hidden overflow-x-auto md:-mx-5 md:block md:px-5">
              <PlayerTable players={players} onSelect={setSelected} />
            </div>
          </>
        )}
      </Card>

      {formerPlayers.length > 0 && (
        <Card className="!p-0">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            onClick={() => setShowFormer((open) => !open)}
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Former players
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Former roster members — match history kept ({formerPlayers.length})
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                showFormer ? "rotate-180" : ""
              }`}
            />
          </button>
          {showFormer && (
            <div className="border-t border-border px-4 pb-4 pt-2 sm:px-5">
              <PlayerCards
                players={formerPlayers}
                onSelect={setSelected}
                muted
              />
              <div className="hidden overflow-x-auto md:block">
                <PlayerTable
                  players={formerPlayers}
                  onSelect={setSelected}
                  muted
                />
              </div>
            </div>
          )}
        </Card>
      )}

      <PlayerDetailModal
        player={selected}
        tierlists={selected ? (tierlistsByPlayerId[selected.id] ?? []) : []}
        onClose={close}
        onRosterChange={close}
      />
    </>
  );
}
