"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LoLRole } from "@prisma/client";
import { formatTeamRole } from "@/lib/player-stats";
import { TierlistCard } from "./TierlistCard";
import { NewTierlistForm } from "./TierlistEditor";

export type TierlistPlayerOption = {
  id: string;
  displayName: string;
  teamRole: LoLRole;
};

export type SerializedTierlist = {
  id: string;
  name: string;
  rows: string;
  updatedAt: string;
  playerId: string | null;
  player: TierlistPlayerOption | null;
};

export function TierlistsView({
  tierlists,
  players,
}: {
  tierlists: SerializedTierlist[];
  players: TierlistPlayerOption[];
}) {
  const [playerFilter, setPlayerFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (playerFilter === "all") return tierlists;
    if (playerFilter === "unassigned") {
      return tierlists.filter((t) => !t.playerId);
    }
    return tierlists.filter((t) => t.playerId === playerFilter);
  }, [tierlists, playerFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, SerializedTierlist[]>();
    for (const t of filtered) {
      const key = t.playerId ?? "__unassigned__";
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    const sections: { key: string; label: string; items: SerializedTierlist[] }[] =
      [];

    for (const p of players) {
      const items = map.get(p.id);
      if (items?.length) {
        sections.push({
          key: p.id,
          label: `${p.displayName} · ${formatTeamRole(p.teamRole)}`,
          items,
        });
        map.delete(p.id);
      }
    }

    const unassigned = map.get("__unassigned__");
    if (unassigned?.length) {
      sections.push({
        key: "__unassigned__",
        label: "Unassigned",
        items: unassigned,
      });
    }

    for (const [key, items] of map) {
      if (key === "__unassigned__" || items.length === 0) continue;
      const player = tierlists.find((t) => t.playerId === key)?.player;
      sections.push({
        key,
        label: player?.displayName ?? "Unknown player",
        items,
      });
    }

    return sections;
  }, [filtered, players, tierlists]);

  const showGrouped = playerFilter === "all" && grouped.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={playerFilter === "all"}
            onClick={() => setPlayerFilter("all")}
          >
            All
          </FilterChip>
          {players.map((p) => (
            <FilterChip
              key={p.id}
              active={playerFilter === p.id}
              onClick={() => setPlayerFilter(p.id)}
            >
              {p.displayName}
            </FilterChip>
          ))}
          {tierlists.some((t) => !t.playerId) && (
            <FilterChip
              active={playerFilter === "unassigned"}
              onClick={() => setPlayerFilter("unassigned")}
            >
              Unassigned
            </FilterChip>
          )}
        </div>
        <div className="ml-auto">
          <NewTierlistForm
            players={players}
            defaultPlayerId={playerFilter !== "all" && playerFilter !== "unassigned" ? playerFilter : players[0]?.id}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted">
            {playerFilter === "all"
              ? "No tierlists yet. Create one for a player."
              : "No tierlists for this filter."}
          </p>
        </div>
      ) : showGrouped ? (
        <div className="space-y-8">
          {grouped.map((section) => (
            <section key={section.key} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
                {section.label}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map((t) => (
                  <TierlistCard
                    key={t.id}
                    id={t.id}
                    name={t.name}
                    rowsJson={t.rows}
                    updatedAt={new Date(t.updatedAt)}
                    playerName={t.player?.displayName ?? null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TierlistCard
              key={t.id}
              id={t.id}
              name={t.name}
              rowsJson={t.rows}
              updatedAt={new Date(t.updatedAt)}
              playerName={t.player?.displayName ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-accent/20 text-accent-bright"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
