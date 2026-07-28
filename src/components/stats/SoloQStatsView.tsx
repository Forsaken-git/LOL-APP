"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatTeamRole } from "@/lib/player-display";
import {
  formatRegionLabel,
  opGgProfileUrl,
  type PlayerRegion,
} from "@/lib/player-accounts-shared";
import { formatDateTime24 } from "@/lib/datetime";
import { formatSoloQRank } from "@/lib/stats/soloq-roster";
import type { TeamRole } from "@/lib/player-profile-types";
import type { SoloQStatsPayload } from "@/lib/riot/types";

export function SoloQStatsView({ initial }: { initial: SoloQStatsPayload }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [fetchedLabel, setFetchedLabel] = useState<string | null>(null);

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
          {data.results.length} account{data.results.length === 1 ? "" : "s"}
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

      {data.results.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No active roster accounts with Riot IDs yet. Add them on the Players
            page.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-border bg-inset/80 text-[11px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Riot ID</th>
                  <th className="px-4 py-3 font-medium">SoloQ</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((row) => {
                  const total =
                    (row.soloq?.wins ?? 0) + (row.soloq?.losses ?? 0);
                  const winRate =
                    total > 0 && row.soloq
                      ? Math.round((row.soloq.wins / total) * 100)
                      : null;

                  return (
                    <tr
                      key={`${row.playerId}-${row.accountId}`}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.displayName}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatTeamRole(row.teamRole as TeamRole)}
                      </td>
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
                        >
                          {row.summonerName}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "ok" && row.soloq ? (
                          <span className="text-foreground">
                            {formatSoloQRank(row.soloq)}
                            {row.soloq.hotStreak ? (
                              <span className="ml-2 text-[11px] uppercase tracking-wide text-accent-bright">
                                hot
                              </span>
                            ) : null}
                          </span>
                        ) : row.status === "unranked" ? (
                          <span className="text-muted">Unranked</span>
                        ) : row.status === "missing_key" ? (
                          <span className="text-faint">Needs API key</span>
                        ) : (
                          <span className="text-rose-300" title={row.error}>
                            {row.error ?? "Error"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted">
                        {row.soloq ? (
                          <>
                            <span className="text-foreground">
                              {row.soloq.wins}W
                            </span>
                            {" · "}
                            <span>{row.soloq.losses}L</span>
                            {winRate != null ? (
                              <span className="text-faint"> · {winRate}%</span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
