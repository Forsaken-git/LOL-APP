 "use client";

import { parseISO } from "date-fns";
import { formatDateTime24Long } from "@/lib/datetime";
import { championImageUrl } from "@/lib/champions";
import { layoutBuildForScoreboard } from "@/lib/build-normalize";
import {
  itemImageUrl,
  keystoneIconUrl,
  runeStyleIconUrl,
  summonerSpellImageUrl,
} from "@/lib/items";
import {
  formatDamage,
  formatGameDuration,
  type MatchScoreboardData,
  type ScoreboardRow,
  type TeamScoreboard,
} from "@/lib/match-scoreboard";

function runeIcons(row: ScoreboardRow): {
  primary: string | null;
  secondary: string | null;
} {
  return {
    primary: row.perks?.primaryStyle
      ? runeStyleIconUrl(row.perks.primaryStyle)
      : null,
    secondary: row.perks?.subStyle ? runeStyleIconUrl(row.perks.subStyle) : null,
  };
}

const KEYSTONE_LABELS: Record<number, string> = {
  8005: "Press the Attack",
  8008: "Lethal Tempo",
  8010: "Conqueror",
  8021: "Fleet Footwork",
  8112: "Electrocute",
  8124: "Predator",
  8128: "Dark Harvest",
  9923: "Hail of Blades",
  8214: "Summon Aery",
  8229: "Arcane Comet",
  8230: "Phase Rush",
  8351: "Glacial Augment",
  8360: "Unsealed Spellbook",
  8369: "First Strike",
  8437: "Grasp of the Undying",
  8439: "Aftershock",
  8465: "Guardian",
  8992: "Deathfire Touch",
};

function keystoneLabel(row: ScoreboardRow): string {
  const keystoneId = row.perks?.slots?.[0];
  if (!keystoneId) return "—";
  return KEYSTONE_LABELS[keystoneId] ?? String(keystoneId);
}

function keystoneIcon(row: ScoreboardRow): string | null {
  const keystoneId = row.perks?.slots?.[0];
  if (!keystoneId) return null;
  return keystoneIconUrl(keystoneId);
}

function kda(row: ScoreboardRow): string {
  if (row.kills == null || row.deaths == null || row.assists == null) return "—";
  return `${row.kills}/${row.deaths}/${row.assists}`;
}

function kp(row: ScoreboardRow, teamRows: ScoreboardRow[]): string {
  if (row.kills == null || row.assists == null) return "—";
  const teamKills = teamRows.reduce((sum, r) => sum + (r.kills ?? 0), 0);
  if (teamKills <= 0) return "—";
  return `${Math.round(((row.kills + row.assists) / teamKills) * 100)}%`;
}

function csPerMin(row: ScoreboardRow, durationSec: number | null): string {
  if (row.cs == null || !durationSec || durationSec <= 0) return "—";
  const cspm = row.cs / (durationSec / 60);
  return cspm.toFixed(1);
}

function TeamTable({
  team,
  title,
  durationSec,
}: {
  team: TeamScoreboard;
  title: string;
  durationSec: number | null;
}) {
  const isMirrored = team.side === "BLUE";
  const tint = team.side === "BLUE" ? "border-sky-500/25" : "border-rose-500/25";
  const bg = team.side === "BLUE" ? "bg-sky-500/[0.04]" : "bg-rose-500/[0.04]";
  const resultColor = team.won ? "text-emerald-400" : "text-rose-400";
  const playerColClass = "w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] px-2 py-2";
  const champColClass = "w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] px-2 py-2";

  return (
    <section className={`rounded-xl border ${tint} ${bg} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className={`text-xs font-semibold uppercase tracking-wide ${resultColor}`}>
          {team.won == null ? "—" : team.won ? "Victory" : "Defeat"}
        </p>
      </div>
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wide text-muted">
            {isMirrored ? (
              <tr>
                <th className="px-2 py-2 text-right">DMG</th>
                <th className="px-2 py-2 text-right">CS/min</th>
                <th className="px-2 py-2 text-right">KP%</th>
                <th className="px-2 py-2 text-right">KDA</th>
                <th className="px-2 py-2 text-center">Quest</th>
                <th className="px-2 py-2 text-center">Trinket</th>
                <th className="px-2 py-2 text-center">Items</th>
                <th className="px-2 py-2 text-center">Runes</th>
                <th className="px-2 py-2 text-center">Spells</th>
                <th className={`${playerColClass} text-right`}>Player</th>
                <th className={`${champColClass} text-right`}>Champ</th>
              </tr>
            ) : (
              <tr>
                <th className={`${champColClass} text-left`}>Champ</th>
                <th className={`${playerColClass} text-left`}>Player</th>
                <th className="px-2 py-2 text-center">Spells</th>
                <th className="px-2 py-2 text-center">Runes</th>
                <th className="px-2 py-2 text-center">Items</th>
                <th className="px-2 py-2 text-center">Trinket</th>
                <th className="px-2 py-2 text-center">Quest</th>
                <th className="px-2 py-2 text-right">KDA</th>
                <th className="px-2 py-2 text-right">KP%</th>
                <th className="px-2 py-2 text-right">CS/min</th>
                <th className="px-2 py-2 text-right">DMG</th>
              </tr>
            )}
          </thead>
          <tbody>
            {team.rows.map((row, idx) => {
              const { questItemId, trinketItemId, coreItems } =
                layoutBuildForScoreboard(
                  {
                    itemIds: row.itemIds,
                    questItemId: row.questItemId ?? undefined,
                    trinketItemId: row.trinketItemId ?? undefined,
                    perks: row.perks ?? undefined,
                  },
                  {
                    position: row.position,
                    laneIndex: idx,
                    scoreboardRole: row.role,
                  },
                );
              const spell1 = row.spell1Id ? summonerSpellImageUrl(row.spell1Id) : null;
              const spell2 = row.spell2Id ? summonerSpellImageUrl(row.spell2Id) : null;
              const runes = runeIcons(row);
              const keystone = keystoneIcon(row);
              return (
                <tr
                  key={`${row.summonerName}-${idx}`}
                  className="h-14 border-t border-white/[0.06]"
                >
                  {isMirrored ? (
                    <>
                      <td className="px-2 py-2 text-right tabular-nums">{formatDamage(row.damage)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{csPerMin(row, durationSec)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{kp(row, team.rows)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{kda(row)}</td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center">
                          {questItemId ? (
                            <img src={itemImageUrl(questItemId)} alt="" className="mx-auto h-4 w-4 rounded" />
                          ) : (
                            <span className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center">
                          {trinketItemId ? (
                            <img src={itemImageUrl(trinketItemId)} alt="" className="mx-auto h-4 w-4 rounded" />
                          ) : (
                            <span className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="grid grid-cols-3 gap-1">
                          {Array.from({ length: 6 }).map((_, slotIndex) => {
                            const id = coreItems[slotIndex];
                            return id ? (
                              <img
                                key={`it-${row.summonerName}-${id}-${slotIndex}`}
                                src={itemImageUrl(id)}
                                alt=""
                                className="h-4 w-4 rounded"
                              />
                            ) : (
                              <span
                                key={`empty-${row.summonerName}-${slotIndex}`}
                                className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/[0.02]"
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-10 flex-col items-center justify-center gap-1">
                          {keystone ? (
                            <img src={keystone} alt={keystoneLabel(row)} className="h-4 w-4 rounded" />
                          ) : (
                            <span
                              title={keystoneLabel(row)}
                              className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/[0.02]"
                            />
                          )}
                          {runes.secondary ? (
                            <img src={runes.secondary} alt="" className="h-4 w-4 rounded" />
                          ) : (
                            <span className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-10 flex-col items-center justify-center gap-1">
                          {spell1 ? <img src={spell1} alt="" className="h-4 w-4 rounded" /> : <span>—</span>}
                          {spell2 ? (
                            <img src={spell2} alt="" className="h-4 w-4 rounded" />
                          ) : (
                            <span className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className={`${playerColClass} text-right font-medium text-foreground truncate`}>
                        {row.summonerName}
                      </td>
                      <td className={champColClass}>
                        <div className="flex items-center justify-end">
                          <img
                            src={championImageUrl(row.champion)}
                            alt={row.champion}
                            className="h-8 w-8 rounded object-cover"
                          />
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={champColClass}>
                        <div className="flex items-center justify-start">
                          <img
                            src={championImageUrl(row.champion)}
                            alt={row.champion}
                            className="h-8 w-8 rounded object-cover"
                          />
                        </div>
                      </td>
                      <td className={`${playerColClass} font-medium text-foreground truncate`}>
                        {row.summonerName}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-10 flex-col items-center justify-center gap-1">
                          {spell1 ? <img src={spell1} alt="" className="h-4 w-4 rounded" /> : <span>—</span>}
                          {spell2 ? (
                            <img src={spell2} alt="" className="h-4 w-4 rounded" />
                          ) : (
                            <span className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-10 flex-col items-center justify-center gap-1">
                          {keystone ? (
                            <img src={keystone} alt={keystoneLabel(row)} className="h-4 w-4 rounded" />
                          ) : (
                            <span
                              title={keystoneLabel(row)}
                              className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/[0.02]"
                            />
                          )}
                          {runes.secondary ? (
                            <img src={runes.secondary} alt="" className="h-4 w-4 rounded" />
                          ) : (
                            <span className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="grid grid-cols-3 gap-1">
                          {Array.from({ length: 6 }).map((_, slotIndex) => {
                            const id = coreItems[slotIndex];
                            return id ? (
                              <img
                                key={`it-${row.summonerName}-${id}-${slotIndex}`}
                                src={itemImageUrl(id)}
                                alt=""
                                className="h-4 w-4 rounded"
                              />
                            ) : (
                              <span
                                key={`empty-${row.summonerName}-${slotIndex}`}
                                className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/[0.02]"
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center">
                          {trinketItemId ? (
                            <img src={itemImageUrl(trinketItemId)} alt="" className="mx-auto h-4 w-4 rounded" />
                          ) : (
                            <span className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center">
                          {questItemId ? (
                            <img src={itemImageUrl(questItemId)} alt="" className="mx-auto h-4 w-4 rounded" />
                          ) : (
                            <span className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{kda(row)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{kp(row, team.rows)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{csPerMin(row, durationSec)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatDamage(row.damage)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MatchScoreboard({ data }: { data: MatchScoreboardData }) {
  const played = parseISO(data.playedAt);
  const duration = formatGameDuration(data.gameDurationSec);

  return (
    <div className="w-full space-y-3 overflow-hidden rounded-lg border border-white/10 bg-[#12141b] p-3 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
        <p className="text-sm font-semibold text-foreground">
          {data.league} · vs {data.opponent ?? "Unknown"}
        </p>
        <p className="text-xs text-muted">
          {formatDateTime24Long(played)}
          {duration ? ` · ${duration}` : ""}
          {" · "}
          {data.result ?? "Upcoming"} · Our side {data.ourSide}
        </p>
      </div>
      <div className="grid gap-3 2xl:grid-cols-2">
        <TeamTable team={data.blue} title="Blue Team" durationSec={data.gameDurationSec} />
        <TeamTable team={data.red} title="Red Team" durationSec={data.gameDurationSec} />
      </div>
    </div>
  );
}
