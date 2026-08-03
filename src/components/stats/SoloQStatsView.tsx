"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatTeamRole } from "@/lib/player-display";
import {
  formatRegionLabel,
  opGgProfileUrl,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";
import { formatDateTime24 } from "@/lib/datetime";
import {
  formatSoloQRank,
  groupSoloQByPlayer,
  type SoloQPlayerSummary,
} from "@/lib/stats/soloq-roster";
import type { TeamRole } from "@/lib/player-profile-types";
import type { SoloQAccountResult, SoloQStatsPayload } from "@/lib/riot/types";
import { SoloQPerformancePanel } from "@/components/stats/SoloQPerformancePanel";

function accountStatusLabel(row: SoloQAccountResult) {
  if (row.status === "ok" && row.soloq) {
    return (
      <span className="text-foreground">
        {formatSoloQRank(row.soloq)}
        {row.soloq.hotStreak ? (
          <span className="ml-2 text-[11px] uppercase tracking-wide text-accent-bright">
            hot
          </span>
        ) : null}
      </span>
    );
  }
  if (row.status === "unranked") {
    return <span className="text-muted">Unranked</span>;
  }
  if (row.status === "missing_key") {
    return <span className="text-faint">Needs API key</span>;
  }
  return (
    <span className="text-rose-300" title={row.error}>
      {row.error ?? "Error"}
    </span>
  );
}

function recordLabel(wins: number, losses: number) {
  const total = wins + losses;
  if (total <= 0) return "—";
  const winRate = Math.round((wins / total) * 100);
  return (
    <>
      <span className="text-foreground">{wins}W</span>
      {" · "}
      <span>{losses}L</span>
      <span className="text-faint"> · {winRate}%</span>
    </>
  );
}

function regionSummary(accounts: SoloQAccountResult[]): string {
  const regions = [...new Set(accounts.map((a) => a.region))];
  if (regions.length === 1) {
    return formatRegionLabel(regions[0]!);
  }
  return regions.map((r) => formatRegionLabel(r)).join(" · ");
}

function SoloQPlayerDetailModal({
  player,
  onClose,
}: {
  player: SoloQPlayerSummary;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"accounts" | "performance">("accounts");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    setTab("accounts");
  }, [player.playerId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.displayName} SoloQ details`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:h-[min(94vh,920px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">
              {player.displayName}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {formatTeamRole(player.teamRole as TeamRole)} ·{" "}
              {player.accounts.length} account
              {player.accounts.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-faint">
              Combined{" "}
              <span className="tabular-nums">
                {recordLabel(player.combinedWins, player.combinedLosses)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-border px-4 pt-3 sm:px-5">
          <div className="flex gap-1 rounded-xl border border-border bg-inset/30 p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === "accounts"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setTab("accounts")}
            >
              Accounts
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === "performance"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setTab("performance")}
            >
              Performance
            </button>
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 ${
            tab === "performance"
              ? "overflow-hidden"
              : "overflow-x-auto overflow-y-auto"
          }`}
        >
          {tab === "accounts" ? (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-border bg-inset/95 text-[11px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Riot ID</th>
                  <th className="px-4 py-3 font-medium">SoloQ</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {player.accounts.map((row) => (
                  <tr
                    key={row.accountId}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-3 text-muted">
                      {formatRegionLabel(row.region)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={opGgProfileUrl(
                          row.region as PlayerRegion,
                          row.summonerName,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-bright underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.summonerName}
                      </a>
                    </td>
                    <td className="px-4 py-3">{accountStatusLabel(row)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {row.soloq
                        ? recordLabel(row.soloq.wins, row.soloq.losses)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <SoloQPerformancePanel
              playerId={player.playerId}
              teamRole={player.teamRole as TeamRole}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function SoloQStatsView({ initial }: { initial: SoloQStatsPayload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [fetchedLabel, setFetchedLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<SoloQPlayerSummary | null>(null);

  const players = groupSoloQByPlayer(data.results);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    // Format only on the client so locale/timezone can't mismatch SSR HTML.
    setFetchedLabel(formatDateTime24(new Date(data.fetchedAt)));
  }, [data.fetchedAt]);

  async function refresh() {
    startTransition(async () => {
      const res = await fetch("/api/stats/soloq", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as SoloQStatsPayload;
      setData(body);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!data.hasApiKey && (
        <Card>
          <p className="text-sm text-foreground">
            Add a Riot development API key to load live SoloQ ranks.
          </p>
          <p className="mt-2 text-sm text-muted">
            Set <code className="text-accent-bright">RIOT_API_KEY</code> in{" "}
            <code className="text-accent-bright">.env</code> (local) or your
            host env vars, then restart the app. Get a key at{" "}
            <a
              href="https://developer.riotgames.com/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-bright underline-offset-2 hover:underline"
            >
              developer.riotgames.com
            </a>
            .
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {players.length} player{players.length === 1 ? "" : "s"}
          {data.results.length !== players.length
            ? ` · ${data.results.length} accounts`
            : ""}
          {fetchedLabel ? ` · updated ${fetchedLabel}` : ""}
        </p>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-2 text-sm"
          onClick={() => void refresh()}
          disabled={pending || !data.hasApiKey}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {players.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No active roster accounts with Riot IDs yet. Add them on the Players
            page.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border bg-inset/80 text-[11px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Accounts</th>
                  <th className="px-4 py-3 font-medium">SoloQ</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="w-10 px-2 py-3 font-medium">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const multi = player.accounts.length > 1;
                  return (
                    <tr
                      key={player.playerId}
                      className="cursor-pointer border-b border-border/70 last:border-0 transition-colors hover:bg-white/[0.03]"
                      onClick={() => setSelected(player)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {player.displayName}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatTeamRole(player.teamRole as TeamRole)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {multi ? (
                          <span>
                            {player.accounts.length} accounts
                            <span className="mt-0.5 block text-[11px] text-faint">
                              {regionSummary(player.accounts)}
                            </span>
                          </span>
                        ) : (
                          <a
                            href={opGgProfileUrl(
                              player.best.region as PlayerRegion,
                              player.best.summonerName,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent-bright underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {player.best.summonerName}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {accountStatusLabel(player.best)}
                        {multi && player.best.status === "ok" && player.best.soloq ? (
                          <span className="mt-0.5 block text-[11px] text-faint">
                            best of {player.accounts.length}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted">
                        {recordLabel(
                          player.combinedWins,
                          player.combinedLosses,
                        )}
                      </td>
                      <td className="px-2 py-3 text-muted">
                        <ChevronRight className="h-4 w-4 opacity-50" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <SoloQPlayerDetailModal
          player={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
