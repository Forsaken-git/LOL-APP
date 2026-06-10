"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { championImageUrl } from "@/lib/champions";
import { formatTeamRole, rosterLabel } from "@/lib/player-display";
import {
  formatRegionLabel,
  groupAccountsByRegion,
  opGgProfileUrl,
} from "@/lib/player-accounts-shared";
import type { ChampionPoolEntry, PlayerProfile } from "@/lib/player-profile-types";
import { PlayerAccountsTab } from "./PlayerAccountsTab";
import { PlayerRosterStatus } from "./PlayerRosterStatus";

type PlayerModalTab = "champions" | "accounts";

const LOL_REGIONS_ORDER = ["WEST", "EAST"] as const;

export type PlayerTierlistSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export function PlayerDetailModal({
  player,
  tierlists = [],
  onClose,
  onRosterChange,
}: {
  player: PlayerProfile | null;
  tierlists?: PlayerTierlistSummary[];
  onClose: () => void;
  onRosterChange?: () => void;
}) {
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!player) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [player, close]);

  const [tab, setTab] = useState<PlayerModalTab>("champions");

  useEffect(() => {
    if (player) setTab("champions");
  }, [player?.id]);

  if (!player) return null;

  const isSub = player.memberRole === "SUB";
  const { overall } = player;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.displayName} stats`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={close}
        aria-label="Close"
      />
      <div className="relative z-10 flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:max-h-[min(92vh,900px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{player.displayName}</h2>
              {!player.active && (
                <Badge variant="default">Former</Badge>
              )}
              <Badge variant={isSub ? "default" : "blue"}>
                {rosterLabel(player.memberRole)}
              </Badge>
              <span className="text-sm font-medium text-muted">
                {formatTeamRole(player.teamRole)}
              </span>
            </div>
            {player.accounts.length > 0 ? (
              <div className="mt-1 space-y-1 text-sm">
                {LOL_REGIONS_ORDER.map((region) => {
                  const list = groupAccountsByRegion(player.accounts)[region];
                  if (list.length === 0) return null;
                  return (
                    <div
                      key={region}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
                        {formatRegionLabel(region)}
                      </span>
                      {list.map((account) => (
                        <a
                          key={account.id ?? `${region}-${account.summonerName}`}
                          href={opGgProfileUrl(region, account.summonerName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-accent text-xs"
                        >
                          {account.summonerName}
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : player.summonerName ? (
              <p className="mt-0.5 text-sm text-muted">{player.summonerName}</p>
            ) : null}
            <p className="mt-1 text-xs text-faint">
              {overall.games} game{overall.games === 1 ? "" : "s"} with result ·{" "}
              <span className="text-emerald-400">{overall.wins}W</span>
              <span className="text-muted">–</span>
              <span className="text-rose-400">{overall.losses}L</span>
              <span className="text-muted"> · </span>
              {overall.winRate}% overall
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {tierlists.length > 0 && (
            <section className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Tierlists
              </span>
              {tierlists.map((t) => (
                <Link
                  key={t.id}
                  href={`/tierlists/${t.id}`}
                  className="rounded-lg border border-border bg-inset/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-accent/30"
                  onClick={close}
                >
                  {t.name}
                </Link>
              ))}
            </section>
          )}

          <div className="mb-4 flex gap-1 rounded-xl border border-border bg-inset/30 p-1">
            <ModalTab
              active={tab === "champions"}
              onClick={() => setTab("champions")}
            >
              Champions
            </ModalTab>
            <ModalTab
              active={tab === "accounts"}
              onClick={() => setTab("accounts")}
            >
              Accounts
            </ModalTab>
          </div>

          {tab === "champions" ? (
            player.champions.length === 0 ? (
              <p className="text-sm text-muted">No games recorded yet.</p>
            ) : (
              <ChampionPoolTable key={player.id} champions={player.champions} />
            )
          ) : (
            <PlayerAccountsTab
              key={player.id}
              playerId={player.id}
              initialAccounts={player.accounts}
            />
          )}
        </div>

        <PlayerRosterStatus
          playerId={player.id}
          displayName={player.displayName}
          active={player.active}
          onChanged={() => {
            onRosterChange?.();
            if (player.active) onClose();
          }}
        />
      </div>
    </div>
  );
}

type ChampionSortKey = "champion" | "games" | "winRate" | "kda";
type SortDirection = "asc" | "desc";

function sortChampions(
  champions: ChampionPoolEntry[],
  key: ChampionSortKey,
  direction: SortDirection,
): ChampionPoolEntry[] {
  const mul = direction === "asc" ? 1 : -1;
  return [...champions].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "champion":
        cmp = a.champion.localeCompare(b.champion);
        break;
      case "games":
        cmp = a.games - b.games;
        break;
      case "winRate":
        cmp = a.winRate - b.winRate;
        break;
      case "kda":
        cmp = (a.combat?.kdaRatio ?? -1) - (b.combat?.kdaRatio ?? -1);
        break;
    }
    return cmp * mul || a.champion.localeCompare(b.champion);
  });
}

function ModalTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent/20 text-accent-bright"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ChampionPoolTable({ champions }: { champions: ChampionPoolEntry[] }) {
  const [sortKey, setSortKey] = useState<ChampionSortKey>("games");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const sorted = useMemo(
    () => sortChampions(champions, sortKey, sortDir),
    [champions, sortKey, sortDir],
  );

  function toggleSort(key: ChampionSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "champion" ? "asc" : "desc");
    }
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1">
    <table className="w-full min-w-[28rem] text-left text-sm">
      <thead>
        <tr className="table-head border-b border-border">
          <SortableTh
            label="Champion"
            active={sortKey === "champion"}
            direction={sortDir}
            onClick={() => toggleSort("champion")}
          />
          <SortableTh
            label="Games"
            align="right"
            active={sortKey === "games"}
            direction={sortDir}
            onClick={() => toggleSort("games")}
          />
          <th className="pb-2 pr-3 text-right font-medium tabular-nums text-muted">
            W–L
          </th>
          <SortableTh
            label="WR%"
            align="right"
            active={sortKey === "winRate"}
            direction={sortDir}
            onClick={() => toggleSort("winRate")}
          />
          <SortableTh
            label="KDA"
            align="right"
            active={sortKey === "kda"}
            direction={sortDir}
            onClick={() => toggleSort("kda")}
            title="Combined K/D/A across games on this champion"
          />
        </tr>
      </thead>
      <tbody>
        {sorted.map((entry) => (
          <ChampionRow key={entry.champion} entry={entry} />
        ))}
      </tbody>
    </table>
    </div>
  );
}

function SortableTh({
  label,
  active,
  direction,
  onClick,
  align = "left",
  title,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
  title?: string;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`pb-2 pr-3 font-medium tabular-nums ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          align === "right" ? "w-full justify-end" : ""
        } ${active ? "text-foreground" : "text-muted"}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
    </th>
  );
}

function ChampionRow({ entry }: { entry: ChampionPoolEntry }) {
  return (
    <tr className="table-row border-t border-white/[0.06]">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2.5">
          <img
            src={championImageUrl(entry.champion)}
            alt=""
            className="h-8 w-8 shrink-0 rounded-md border border-border bg-inset"
          />
          <span className="font-medium text-foreground">{entry.champion}</span>
        </div>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums text-muted">{entry.games}</td>
      <td className="py-2 pr-3 text-right tabular-nums">
        <Wl wins={entry.wins} losses={entry.losses} />
      </td>
      <td className="py-2 pr-3 text-right tabular-nums text-foreground">
        {entry.winRate}%
      </td>
      <td
        className="py-2 text-right tabular-nums font-medium text-foreground"
        title={entry.combat?.kdaLine}
      >
        {entry.combat?.kdaRatioLabel ?? "—"}
      </td>
    </tr>
  );
}

function Wl({ wins, losses }: { wins: number; losses: number }) {
  return (
    <>
      <span className="text-emerald-400">{wins}</span>
      <span className="text-muted">–</span>
      <span className="text-rose-400">{losses}</span>
    </>
  );
}
