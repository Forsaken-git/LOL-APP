"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import { formatDateTime24 } from "@/lib/datetime";
import { formatRegionLabel } from "@/lib/player-accounts-shared";
import type { TeamRole } from "@/lib/player-profile-types";
import type { SoloQAdvancedMetrics } from "@/lib/stats/soloq-advanced-types";

function Section({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 ${className}`.trim()}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-inset/35 px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[11px] text-faint">{detail}</p> : null}
    </div>
  );
}

function fmt(n: number | null, digits = 1): string {
  if (n == null) return "—";
  return n.toFixed(digits);
}

function consistencyLabel(stdDev: number | null): {
  value: string;
  detail: string;
} {
  if (stdDev == null) {
    return { value: "—", detail: "Need more games" };
  }
  if (stdDev <= 0.35) {
    return { value: "Steady", detail: "Results don’t swing much" };
  }
  if (stdDev <= 0.48) {
    return { value: "Mixed", detail: "Some win/loss streaks" };
  }
  return { value: "Volatile", detail: "Big swings game to game" };
}

export function SoloQPerformancePanel({
  playerId,
  teamRole,
}: {
  playerId: string;
  teamRole?: TeamRole;
}) {
  const [metrics, setMetrics] = useState<SoloQAdvancedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNotes, setSyncNotes] = useState<string[]>([]);
  const [syncedLabel, setSyncedLabel] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/soloq-advanced`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        metrics?: SoloQAdvancedMetrics;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Failed to load");
        return;
      }
      if (body.metrics) setMetrics(body.metrics);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    setSyncNotes([]);
    try {
      const res = await fetch(`/api/players/${playerId}/soloq-advanced`, {
        method: "POST",
      });
      const body = (await res.json()) as {
        metrics?: SoloQAdvancedMetrics;
        syncedMatches?: number;
        errors?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Sync failed");
        return;
      }
      if (body.metrics) setMetrics(body.metrics);
      const notes: string[] = [];
      if (typeof body.syncedMatches === "number") {
        notes.push(
          body.syncedMatches === 0
            ? "Already up to date"
            : `Added ${body.syncedMatches} new game${body.syncedMatches === 1 ? "" : "s"}`,
        );
      }
      if (body.errors?.length) {
        notes.push(...body.errors.slice(0, 3));
      }
      setSyncNotes(notes);
    } catch {
      setError("Network error");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [playerId]);

  useEffect(() => {
    if (!metrics?.lastSyncedAt) {
      setSyncedLabel(null);
      return;
    }
    setSyncedLabel(formatDateTime24(new Date(metrics.lastSyncedAt)));
  }, [metrics?.lastSyncedAt]);

  if (loading && !metrics) {
    return (
      <p className="px-4 py-6 text-sm text-muted">Loading SoloQ metrics…</p>
    );
  }

  if (error && !metrics) {
    return (
      <div className="space-y-3 px-4 py-6">
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => void sync()}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "Sync from Riot"}
        </button>
        <button
          type="button"
          className="ml-2 text-xs text-muted underline-offset-2 hover:underline"
          onClick={() => void load()}
          disabled={loading || syncing}
        >
          Retry load
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const empty = metrics.matchCount === 0;
  const consistency = consistencyLabel(metrics.volume.consistencyStdDev);
  const week = metrics.volume.windows.find((w) => w.days === 7);
  const month = metrics.volume.windows.find((w) => w.days === 30);
  const showVision =
    teamRole === "SUPPORT" || metrics.supportFocus;

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            SoloQ performance
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Riot ranked / normal games only — not team scrims.
            {metrics.matchCount > 0
              ? ` · ${metrics.matchCount} game${metrics.matchCount === 1 ? "" : "s"}`
              : ""}
            {syncedLabel ? ` · synced ${syncedLabel}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost inline-flex shrink-0 items-center gap-2 text-xs"
          onClick={() => void sync()}
          disabled={syncing}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing…" : empty ? "Sync matches" : "Refresh matches"}
        </button>
      </div>

      {error ? (
        <p className="mb-2 shrink-0 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {syncNotes.length > 0 ? (
        <ul className="mb-2 shrink-0 space-y-0.5 text-xs text-faint">
          {syncNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        <p className="rounded-xl border border-dashed border-border bg-inset/30 px-4 py-5 text-sm text-muted">
          Sync pulls this player&apos;s recent SoloQ / normal queue games from
          Riot. Metrics appear here after the first sync.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-2 lg:gap-5 lg:overflow-hidden">
          <div className="space-y-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <Section
              title="In-game averages"
              description="Per-minute and efficiency across cached games"
            >
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                {showVision ? (
                  <>
                    <MetricTile
                      label="Vision"
                      value={fmt(metrics.averages.visionScore, 1)}
                      detail="Avg score / game"
                    />
                    <MetricTile
                      label="Vision / min"
                      value={fmt(metrics.averages.visionPerMin, 1)}
                    />
                    <MetricTile
                      label="Control wards"
                      value={fmt(metrics.averages.controlWardsBought, 1)}
                      detail="Bought / game"
                    />
                  </>
                ) : (
                  <MetricTile
                    label="CS / min"
                    value={fmt(metrics.averages.csPerMin, 1)}
                  />
                )}
                <MetricTile
                  label="Gold / min"
                  value={fmt(metrics.averages.goldPerMin, 0)}
                />
                <MetricTile
                  label="Damage / min"
                  value={fmt(metrics.averages.damagePerMin, 0)}
                />
                <MetricTile
                  label="Gold efficiency"
                  value={fmt(metrics.averages.goldEfficiency, 2)}
                  detail="Damage per gold"
                />
                <MetricTile
                  label="Damage share"
                  value={
                    metrics.averages.damageShare != null
                      ? `${Math.round(metrics.averages.damageShare * 100)}%`
                      : "—"
                  }
                  detail="Of team damage"
                />
              </div>
            </Section>

            <Section
              title="Volume & consistency"
              description="Play volume and result stability"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MetricTile
                  label="Last 7 days"
                  value={week ? `${week.games} games` : "—"}
                  detail={
                    week && week.games > 0
                      ? `${week.wins}W – ${week.losses}L · ${week.winRate}%`
                      : "No games"
                  }
                />
                <MetricTile
                  label="Last 30 days"
                  value={month ? `${month.games} games` : "—"}
                  detail={
                    month && month.games > 0
                      ? `${month.wins}W – ${month.losses}L · ${month.winRate}%`
                      : "No games"
                  }
                />
                <MetricTile
                  label="Consistency"
                  value={consistency.value}
                  detail={consistency.detail}
                />
              </div>
            </Section>

            <Section
              title="Champion habits"
              description="Spam pressure and recent focus"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MetricTile
                  label="Most played recently"
                  value={
                    metrics.spam.topChampion && metrics.spam.shareLastN != null
                      ? metrics.spam.topChampion
                      : "—"
                  }
                  detail={
                    metrics.spam.topChampion && metrics.spam.shareLastN != null
                      ? `${Math.round(metrics.spam.shareLastN * 100)}% of last ${metrics.spam.window}`
                      : "Not enough games"
                  }
                />
                <MetricTile
                  label="Longest streak"
                  value={
                    metrics.spam.longestStreak >= 2 &&
                    metrics.spam.longestStreakChampion
                      ? `${metrics.spam.longestStreakChampion} ×${metrics.spam.longestStreak}`
                      : "—"
                  }
                  detail="Same champion in a row"
                />
              </div>
            </Section>
          </div>

          <div className="flex flex-col gap-5 lg:min-h-0 lg:overflow-hidden">
            {metrics.patchAdaptability.length > 0 ? (
              <Section
                title="By patch"
                description="Win rate per game version"
                className="shrink-0"
              >
                <div className="max-h-40 overflow-auto rounded-xl border border-border sm:max-h-44">
                  <table className="w-full min-w-[18rem] text-left text-sm">
                    <thead className="sticky top-0 border-b border-border bg-inset/95 text-[11px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Patch</th>
                        <th className="px-3 py-2 font-medium">Games</th>
                        <th className="px-3 py-2 font-medium">Record</th>
                        <th className="px-3 py-2 font-medium">WR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.patchAdaptability.map((p) => (
                        <tr
                          key={p.patch}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="px-3 py-1.5 font-medium text-foreground">
                            {p.patch}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-muted">
                            {p.games}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-muted">
                            {p.wins}W – {p.games - p.wins}L
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-foreground">
                            {p.winRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            ) : null}

            {metrics.champions.length > 0 ? (
              <Section
                title="Champions played"
                description="Sorted by games in the SoloQ cache"
                className="flex min-h-56 flex-col lg:min-h-0 lg:flex-1"
              >
                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
                  <table
                    className={`w-full text-left text-sm ${
                      showVision ? "min-w-[32rem]" : "min-w-[28rem]"
                    }`}
                  >
                    <thead className="sticky top-0 border-b border-border bg-inset/95 text-[11px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Champion</th>
                        <th className="px-3 py-2 font-medium">Games</th>
                        <th className="px-3 py-2 font-medium">WR</th>
                        {showVision ? (
                          <>
                            <th className="px-3 py-2 font-medium">Vision</th>
                            <th className="px-3 py-2 font-medium">Vis/min</th>
                            <th className="px-3 py-2 font-medium">Ctrl</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2 font-medium">CS/min</th>
                            <th className="px-3 py-2 font-medium">Dmg/gold</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.champions.map((c) => (
                        <tr
                          key={c.champion}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <ChampionIcon champion={c.champion} />
                              <span className="font-medium text-foreground">
                                {c.champion}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-muted">
                            {c.games}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-foreground">
                            {c.winRate}%
                          </td>
                          {showVision ? (
                            <>
                              <td className="px-3 py-1.5 tabular-nums text-muted">
                                {c.avgVisionScore != null
                                  ? c.avgVisionScore.toFixed(1)
                                  : "—"}
                              </td>
                              <td className="px-3 py-1.5 tabular-nums text-muted">
                                {c.avgVisionPerMin != null
                                  ? c.avgVisionPerMin.toFixed(1)
                                  : "—"}
                              </td>
                              <td className="px-3 py-1.5 tabular-nums text-muted">
                                {c.avgControlWardsBought != null
                                  ? c.avgControlWardsBought.toFixed(1)
                                  : "—"}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 tabular-nums text-muted">
                                {c.avgCsPerMin.toFixed(1)}
                              </td>
                              <td className="px-3 py-1.5 tabular-nums text-muted">
                                {c.avgDamagePerGold.toFixed(2)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            ) : null}

            {metrics.accounts.length > 1 ? (
              <p className="shrink-0 text-[11px] text-faint">
                Combined across{" "}
                {metrics.accounts
                  .map(
                    (a) =>
                      `${a.summonerName} (${formatRegionLabel(a.region)}, ${a.matchCount}g)`,
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
