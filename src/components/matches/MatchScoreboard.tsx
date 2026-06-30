 "use client";

import { parseISO } from "date-fns";
import { formatDateTime24Long } from "@/lib/datetime";
import { championImageUrl } from "@/lib/champions";
import { layoutBuildForScoreboard } from "@/lib/build-normalize";
import {
  keystoneIconUrl,
  runeStyleIconUrl,
} from "@/lib/items";
import {
  formatDamage,
  formatGameDuration,
  type MatchScoreboardData,
  type ScoreboardRow,
  type TeamScoreboard,
} from "@/lib/match-scoreboard";
import {
  ScoreboardItemIcon,
  ScoreboardRuneIcon,
  ScoreboardSpellIcon,
  useScoreboardCatalogs,
  type ScoreboardCatalogs,
} from "@/components/matches/ScoreboardItemIcon";

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

/** Scoreboard icon sizes — fixed square slots so table cells cannot squash them */
const SB_ITEM = "size-10 shrink-0 rounded object-cover";
const SB_ICON = "size-9 shrink-0 rounded object-cover";
const SB_EMPTY = "size-10 shrink-0 rounded border border-dashed border-white/10 bg-white/[0.02]";
const SB_EMPTY_SM = "size-9 shrink-0 rounded border border-dashed border-white/10 bg-white/[0.02]";
const SB_CHAMP = "size-11 shrink-0 rounded object-cover";
const SB_ROW = "min-h-[6.25rem]";
const SB_STACK = "flex min-h-[3.75rem] flex-col items-center justify-center gap-1.5";
const SB_ITEMS_COL = "w-[8.5rem] min-w-[8.5rem] px-1.5 py-2";
const SB_ICON_COL = "w-11 min-w-11 px-1 py-2";
const SB_RUNE_COL = "w-12 min-w-12 px-1 py-2";
const SB_SPELL_COL = "w-12 min-w-12 px-1 py-2";
const SB_STAT_COL = "w-14 min-w-14 px-2 py-2 whitespace-nowrap";

function TeamTable({
  team,
  title,
  durationSec,
  catalogs,
}: {
  team: TeamScoreboard;
  title: string;
  durationSec: number | null;
  catalogs: ScoreboardCatalogs;
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-xs">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wide text-muted">
            {isMirrored ? (
              <tr>
                <th className={`${SB_STAT_COL} text-right`}>DMG</th>
                <th className={`${SB_STAT_COL} text-right`}>CS/min</th>
                <th className={`${SB_STAT_COL} text-right`}>KP%</th>
                <th className={`${SB_STAT_COL} text-right`}>KDA</th>
                <th className={`${SB_ICON_COL} text-center`}>Quest</th>
                <th className={`${SB_ICON_COL} text-center`}>Trinket</th>
                <th className={`${SB_ITEMS_COL} text-center`}>Items</th>
                <th className={`${SB_RUNE_COL} text-center`}>Runes</th>
                <th className={`${SB_SPELL_COL} text-center`}>Spells</th>
                <th className={`${playerColClass} text-right`}>Player</th>
                <th className={`${champColClass} text-right`}>Champ</th>
              </tr>
            ) : (
              <tr>
                <th className={`${champColClass} text-left`}>Champ</th>
                <th className={`${playerColClass} text-left`}>Player</th>
                <th className={`${SB_SPELL_COL} text-center`}>Spells</th>
                <th className={`${SB_RUNE_COL} text-center`}>Runes</th>
                <th className={`${SB_ITEMS_COL} text-center`}>Items</th>
                <th className={`${SB_ICON_COL} text-center`}>Trinket</th>
                <th className={`${SB_ICON_COL} text-center`}>Quest</th>
                <th className={`${SB_STAT_COL} text-right`}>KDA</th>
                <th className={`${SB_STAT_COL} text-right`}>KP%</th>
                <th className={`${SB_STAT_COL} text-right`}>CS/min</th>
                <th className={`${SB_STAT_COL} text-right`}>DMG</th>
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
              const spell1 = row.spell1Id ?? null;
              const spell2 = row.spell2Id ?? null;
              const keystoneId = row.perks?.slots?.[0] ?? null;
              const subStyleId = row.perks?.subStyle ?? null;
              return (
                <tr
                  key={`${row.summonerName}-${idx}`}
                  className={`${SB_ROW} border-t border-white/[0.06]`}
                >
                  {isMirrored ? (
                    <>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{formatDamage(row.damage)}</td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{csPerMin(row, durationSec)}</td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{kp(row, team.rows)}</td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{kda(row)}</td>
                      <td className={SB_ICON_COL}>
                        <div className="flex justify-center">
                          {questItemId ? (
                            <ScoreboardItemIcon
                              itemId={questItemId}
                              catalog={catalogs.items}
                              className={SB_ICON}
                            />
                          ) : (
                            <span className={SB_EMPTY_SM} />
                          )}
                        </div>
                      </td>
                      <td className={SB_ICON_COL}>
                        <div className="flex justify-center">
                          {trinketItemId ? (
                            <ScoreboardItemIcon
                              itemId={trinketItemId}
                              catalog={catalogs.items}
                              className={SB_ICON}
                            />
                          ) : (
                            <span className={SB_EMPTY_SM} />
                          )}
                        </div>
                      </td>
                      <td className={SB_ITEMS_COL}>
                        <div className="mx-auto grid w-fit grid-cols-3 gap-1.5">
                          {Array.from({ length: 6 }).map((_, slotIndex) => {
                            const id = coreItems[slotIndex];
                            return id ? (
                              <ScoreboardItemIcon
                                key={`it-${row.summonerName}-${id}-${slotIndex}`}
                                itemId={id}
                                catalog={catalogs.items}
                                className={SB_ITEM}
                              />
                            ) : (
                              <span
                                key={`empty-${row.summonerName}-${slotIndex}`}
                                className={SB_EMPTY}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className={SB_RUNE_COL}>
                        <div className={SB_STACK}>
                          <ScoreboardRuneIcon
                            runeId={keystoneId}
                            imageUrl={keystoneIcon(row)}
                            catalog={catalogs.runes}
                            fallbackName={keystoneLabel(row)}
                            className={SB_ICON}
                          />
                          <ScoreboardRuneIcon
                            runeId={subStyleId}
                            imageUrl={runeIcons(row).secondary}
                            catalog={catalogs.runes}
                            className={SB_ICON}
                          />
                        </div>
                      </td>
                      <td className={SB_SPELL_COL}>
                        <div className={SB_STACK}>
                          {spell1 ? (
                            <ScoreboardSpellIcon
                              spellId={spell1}
                              catalog={catalogs.spells}
                              className={SB_ICON}
                            />
                          ) : (
                            <span>—</span>
                          )}
                          {spell2 ? (
                            <ScoreboardSpellIcon
                              spellId={spell2}
                              catalog={catalogs.spells}
                              className={SB_ICON}
                            />
                          ) : (
                            <span className={SB_EMPTY_SM} />
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
                            className={SB_CHAMP}
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
                            className={SB_CHAMP}
                          />
                        </div>
                      </td>
                      <td className={`${playerColClass} font-medium text-foreground truncate`}>
                        {row.summonerName}
                      </td>
                      <td className={SB_SPELL_COL}>
                        <div className={SB_STACK}>
                          {spell1 ? (
                            <ScoreboardSpellIcon
                              spellId={spell1}
                              catalog={catalogs.spells}
                              className={SB_ICON}
                            />
                          ) : (
                            <span>—</span>
                          )}
                          {spell2 ? (
                            <ScoreboardSpellIcon
                              spellId={spell2}
                              catalog={catalogs.spells}
                              className={SB_ICON}
                            />
                          ) : (
                            <span className={SB_EMPTY_SM} />
                          )}
                        </div>
                      </td>
                      <td className={SB_RUNE_COL}>
                        <div className={SB_STACK}>
                          <ScoreboardRuneIcon
                            runeId={keystoneId}
                            imageUrl={keystoneIcon(row)}
                            catalog={catalogs.runes}
                            fallbackName={keystoneLabel(row)}
                            className={SB_ICON}
                          />
                          <ScoreboardRuneIcon
                            runeId={subStyleId}
                            imageUrl={runeIcons(row).secondary}
                            catalog={catalogs.runes}
                            className={SB_ICON}
                          />
                        </div>
                      </td>
                      <td className={SB_ITEMS_COL}>
                        <div className="mx-auto grid w-fit grid-cols-3 gap-1.5">
                          {Array.from({ length: 6 }).map((_, slotIndex) => {
                            const id = coreItems[slotIndex];
                            return id ? (
                              <ScoreboardItemIcon
                                key={`it-${row.summonerName}-${id}-${slotIndex}`}
                                itemId={id}
                                catalog={catalogs.items}
                                className={SB_ITEM}
                              />
                            ) : (
                              <span
                                key={`empty-${row.summonerName}-${slotIndex}`}
                                className={SB_EMPTY}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className={SB_ICON_COL}>
                        <div className="flex justify-center">
                          {trinketItemId ? (
                            <ScoreboardItemIcon
                              itemId={trinketItemId}
                              catalog={catalogs.items}
                              className={SB_ICON}
                            />
                          ) : (
                            <span className={SB_EMPTY_SM} />
                          )}
                        </div>
                      </td>
                      <td className={SB_ICON_COL}>
                        <div className="flex justify-center">
                          {questItemId ? (
                            <ScoreboardItemIcon
                              itemId={questItemId}
                              catalog={catalogs.items}
                              className={SB_ICON}
                            />
                          ) : (
                            <span className={SB_EMPTY_SM} />
                          )}
                        </div>
                      </td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{kda(row)}</td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{kp(row, team.rows)}</td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{csPerMin(row, durationSec)}</td>
                      <td className={`${SB_STAT_COL} text-right tabular-nums`}>{formatDamage(row.damage)}</td>
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
  const catalogs = useScoreboardCatalogs();

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
        <TeamTable team={data.blue} title="Blue Team" durationSec={data.gameDurationSec} catalogs={catalogs} />
        <TeamTable team={data.red} title="Red Team" durationSec={data.gameDurationSec} catalogs={catalogs} />
      </div>
    </div>
  );
}
