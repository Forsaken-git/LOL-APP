"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import {
  formatRegionLabel,
  LOL_REGIONS,
  opGgProfileUrl,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";
import { formatDateTime24 } from "@/lib/datetime";
import { parseScoutingInput } from "@/lib/scouting/parse-input";
import {
  clearScoutingSession,
  loadScoutingSession,
  saveScoutingSession,
} from "@/lib/scouting/session";
import type {
  ScoutingPlayerResult,
  ScoutingReport,
} from "@/lib/scouting/types";
import { formatSoloQRank } from "@/lib/stats/soloq-roster";

function formatKdaLine(kills: number, deaths: number, assists: number, kda: number) {
  return `${kills}/${deaths}/${assists} · ${kda.toFixed(2)}`;
}

function PlayerRow({ player }: { player: ScoutingPlayerResult }) {
  const [open, setOpen] = useState(false);

  if (player.status === "error" && player.recentGames === 0 && !player.soloq) {
    return (
      <div className="border-b border-border px-4 py-3 last:border-b-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium text-foreground">{player.riotId}</p>
          <p className="text-sm text-rose-300">{player.error ?? "Error"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-inset/60"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mt-1 text-faint">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a
              href={opGgProfileUrl(player.region, player.riotId)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-bright underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {player.riotId}
            </a>
            <span className="text-sm text-muted">
              {player.soloq ? formatSoloQRank(player.soloq) : "Unranked"}
            </span>
            {player.error ? (
              <span className="text-xs text-amber-300">{player.error}</span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="tabular-nums">
              {player.recentGames > 0 ? (
                <>
                  <span className="text-foreground">{player.recentWins}W</span>
                  {" · "}
                  {player.recentLosses}L
                  <span className="text-faint">
                    {" "}
                    · {player.recentWinRate}%
                  </span>
                  <span className="text-faint">
                    {" "}
                    ({player.recentGames} ranked)
                  </span>
                </>
              ) : (
                "No recent ranked games"
              )}
            </span>
            {player.recentGames > 0 ? (
              <span className="tabular-nums text-foreground">
                KDA{" "}
                {formatKdaLine(
                  player.recentKills,
                  player.recentDeaths,
                  player.recentAssists,
                  player.recentKda,
                )}
              </span>
            ) : null}
          </div>
          {player.champions.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {player.champions.map((c) => (
                <span
                  key={c.champion}
                  className="inline-flex items-center gap-1.5 text-xs text-muted"
                  title={`${c.champion}: ${c.games}g · ${c.winRate}% · ${c.kda.toFixed(2)} KDA`}
                >
                  <ChampionIcon
                    champion={c.champion}
                    className="h-7 w-7 rounded-md border border-border"
                    alt={c.champion}
                  />
                  <span className="tabular-nums text-faint">{c.games}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      {open && player.champions.length > 0 ? (
        <div className="border-t border-border bg-inset/40 px-4 py-3 pl-11">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-faint">
                <th className="pb-2 font-medium">Champion</th>
                <th className="pb-2 font-medium">Games</th>
                <th className="pb-2 font-medium">WR</th>
                <th className="pb-2 font-medium">KDA</th>
              </tr>
            </thead>
            <tbody>
              {player.champions.map((c) => (
                <tr key={c.champion} className="border-t border-border/60">
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2">
                      <ChampionIcon
                        champion={c.champion}
                        className="h-6 w-6 rounded-md border border-border"
                        alt=""
                      />
                      <span className="text-foreground">{c.champion}</span>
                    </span>
                  </td>
                  <td className="py-2 tabular-nums text-muted">
                    {c.wins}W · {c.losses}L
                  </td>
                  <td className="py-2 tabular-nums text-muted">{c.winRate}%</td>
                  <td className="py-2 tabular-nums text-muted">
                    {formatKdaLine(c.kills, c.deaths, c.assists, c.kda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {open && player.champions.length === 0 ? (
        <div className="border-t border-border bg-inset/40 px-4 py-3 pl-11 text-sm text-muted">
          No champion sample in the recent ranked window.
        </div>
      ) : null}
    </div>
  );
}

export function ScoutingView() {
  const [input, setInput] = useState("");
  const [region, setRegion] = useState<PlayerRegion>("WEST");
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [fetchedLabel, setFetchedLabel] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadScoutingSession();
    if (saved) {
      setInput(saved.input);
      setRegion(saved.region);
      setReport(saved.report);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveScoutingSession({ input, region, report });
  }, [hydrated, input, region, report]);

  useEffect(() => {
    if (!report?.fetchedAt) {
      setFetchedLabel(null);
      return;
    }
    setFetchedLabel(formatDateTime24(new Date(report.fetchedAt)));
  }, [report?.fetchedAt]);

  const preview = useMemo(
    () => parseScoutingInput(input, region),
    [input, region],
  );

  function runScout() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/scouting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, region }),
        cache: "no-store",
      });
      const body = (await res.json()) as ScoutingReport & {
        error?: string;
        warnings?: string[];
      };
      if (!res.ok) {
        setError(body.error ?? "Failed to scout");
        return;
      }
      setReport(body);
    });
  }

  function clearSession() {
    clearScoutingSession();
    setInput("");
    setRegion("WEST");
    setReport(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <Card title="Enemy lobby">
        <label className="block text-sm text-muted" htmlFor="scouting-input">
          Paste an OP.GG multisearch URL or Riot IDs (one per line, max 5)
        </label>
        <textarea
          id="scouting-input"
          className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-border bg-inset px-3 py-2.5 text-sm text-foreground outline-none ring-accent/40 placeholder:text-faint focus:ring-2"
          placeholder={
            "https://op.gg/lol/multisearch/euw?summoners=Player1%23EUW,Player2%23EUW\n\nor\n\nPlayer1#EUW\nPlayer2#EUW"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-inset p-0.5">
            {LOL_REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  region === r
                    ? "bg-surface text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
                onClick={() => setRegion(r)}
                disabled={pending}
              >
                {formatRegionLabel(r)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 text-sm"
            onClick={() => void runScout()}
            disabled={pending || !input.trim()}
          >
            <Search className={`h-3.5 w-3.5 ${pending ? "animate-pulse" : ""}`} />
            {pending ? "Scouting…" : report ? "Re-scout" : "Scout"}
          </button>

          {(input.trim() || report) && !pending ? (
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5 text-sm text-muted"
              onClick={clearSession}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}

          {preview.riotIds.length > 0 ? (
            <p className="text-xs text-faint">
              {preview.riotIds.length} player
              {preview.riotIds.length === 1 ? "" : "s"}
              {preview.regionSource === "url"
                ? ` · region from URL (${formatRegionLabel(preview.region)})`
                : ` · ${formatRegionLabel(region)}`}
            </p>
          ) : null}
        </div>

        {preview.warnings.length > 0 && input.trim() ? (
          <ul className="mt-3 space-y-1 text-xs text-amber-300/90">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      {error ? (
        <Card>
          <p className="text-sm text-rose-300">{error}</p>
        </Card>
      ) : null}

      {pending ? (
        <Card>
          <p className="text-sm text-muted">
            Resolving accounts and ranked Match-V5 history. This can take a
            moment for a full lobby.
          </p>
        </Card>
      ) : null}

      {report && !pending ? (
        <div className="space-y-3">
          {!report.hasApiKey ? (
            <Card>
              <p className="text-sm text-foreground">
                Add a Riot development API key to scout players.
              </p>
              <p className="mt-2 text-sm text-muted">
                Set <code className="text-accent-bright">RIOT_API_KEY</code> in{" "}
                <code className="text-accent-bright">.env</code>, then restart.
              </p>
            </Card>
          ) : null}

          {report.warnings.length > 0 ? (
            <ul className="space-y-1 text-xs text-amber-300/90">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <Card
            title={`Report · ${formatRegionLabel(report.region)} · last ~${report.sampleSize} matches`}
            action={
              fetchedLabel ? (
                <span className="text-[11px] text-faint">
                  Saved · {fetchedLabel}
                </span>
              ) : null
            }
          >
            <div className="-mx-5 -mb-5 -mt-1 overflow-hidden rounded-b-2xl border-t border-border">
              {report.players.map((p) => (
                <PlayerRow key={p.riotId} player={p} />
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
