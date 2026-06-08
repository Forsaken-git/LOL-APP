"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatTime24, normalizeTime24Input, TIME_24_PATTERN } from "@/lib/datetime";
import type { GameType, LoLRole, MatchResult, Side } from "@prisma/client";
import { COMPETITIONS } from "@/lib/competitions";
import { DDRAGON_VERSION } from "@/lib/champions";
import {
  finalizeParticipantBuild,
  laneIndexFromPosition,
  scoreboardRoleForLaneIndex,
} from "@/lib/build-normalize";
import type { ParticipantBuild } from "@/lib/ingest/types";
import {
  buildItemNameLookup,
  parseItemInput,
  type ItemNameLookup,
} from "@/lib/items";
import { ChampionDatalist, ChampionInput } from "./ChampionInput";

export type RosterPlayerOption = {
  id: string;
  displayName: string;
  summonerName: string | null;
  teamRole: LoLRole;
};

export type ManualMatchFormInitial = {
  date: string;
  time: string;
  gameDuration: string;
  league: string;
  opponent: string;
  result: MatchResult;
  side: Side;
  gameType: GameType;
  notes: string;
  ourRows: OurRow[];
  enemyRows: EnemyRow[];
};

const LEAGUE_PRESETS = [
  ...COMPETITIONS.map((c) => c.league),
  "Practice",
] as const;

const LANES = [
  { label: "Top", position: "TOP", preferRole: "TOP" as LoLRole },
  { label: "Jungle", position: "JUNGLE", preferRole: "JUNGLE" as LoLRole },
  { label: "Mid", position: "MIDDLE", preferRole: "MID" as LoLRole },
  { label: "ADC", position: "BOTTOM", preferRole: "ADC" as LoLRole },
  { label: "Support", position: "UTILITY", preferRole: "SUPPORT" as LoLRole },
] as const;

type StatFields = {
  kills: string;
  deaths: string;
  assists: string;
  cs: string;
  damage: string;
  goldEarned: string;
  visionScore: string;
  itemSlots: string[];
  trinketId: string;
  spell1Id: string;
  spell2Id: string;
  keystoneId: string;
  primaryStyleId: string;
  subStyleId: string;
};

type OurRow = StatFields & {
  playerId: string;
  champion: string;
};

type EnemyRow = StatFields & {
  label: string;
  champion: string;
};

type ItemLookup = {
  options: { id: number; name: string }[];
  byName: ItemNameLookup;
};

type SpellLookup = {
  options: { id: number; name: string }[];
};
type KeystoneOption = {
  id: number;
  label: string;
  styleId: number;
};

const RUNE_STYLE_OPTIONS = [
  { id: 8000, label: "Precision" },
  { id: 8100, label: "Domination" },
  { id: 8200, label: "Sorcery" },
  { id: 8300, label: "Inspiration" },
  { id: 8400, label: "Resolve" },
] as const;

const RENDERABLE_SUMMONER_SPELL_IDS = new Set([
  1, 3, 4, 6, 7, 11, 12, 13, 14, 21, 32,
]);

const FALLBACK_KEYSTONE_OPTIONS: KeystoneOption[] = [
  { id: 8005, label: "Press the Attack", styleId: 8000 },
  { id: 8008, label: "Lethal Tempo", styleId: 8000 },
  { id: 8010, label: "Conqueror", styleId: 8000 },
  { id: 8021, label: "Fleet Footwork", styleId: 8000 },
  { id: 8112, label: "Electrocute", styleId: 8100 },
  { id: 8124, label: "Predator", styleId: 8100 },
  { id: 8128, label: "Dark Harvest", styleId: 8100 },
  { id: 9923, label: "Hail of Blades", styleId: 8100 },
  { id: 8214, label: "Summon Aery", styleId: 8200 },
  { id: 8229, label: "Arcane Comet", styleId: 8200 },
  { id: 8230, label: "Phase Rush", styleId: 8200 },
  { id: 8351, label: "Glacial Augment", styleId: 8300 },
  { id: 8360, label: "Unsealed Spellbook", styleId: 8300 },
  { id: 8369, label: "First Strike", styleId: 8300 },
  { id: 8437, label: "Grasp of the Undying", styleId: 8400 },
  { id: 8439, label: "Aftershock", styleId: 8400 },
  { id: 8465, label: "Guardian", styleId: 8400 },
];

function emptyStats(): StatFields {
  return {
    kills: "",
    deaths: "",
    assists: "",
    cs: "",
    damage: "",
    goldEarned: "",
    visionScore: "",
    itemSlots: Array.from({ length: 7 }, () => ""),
    trinketId: "",
    spell1Id: "",
    spell2Id: "",
    keystoneId: "",
    primaryStyleId: "",
    subStyleId: "",
  };
}

function defaultOurRows(players: RosterPlayerOption[]): OurRow[] {
  return LANES.map((lane) => {
    const match =
      players.find((p) => p.teamRole === lane.preferRole) ??
      players.find((p) => p.teamRole === "FILL");
    return {
      playerId: match?.id ?? "",
      champion: "",
      ...emptyStats(),
    };
  });
}

function defaultEnemyRows(): EnemyRow[] {
  return LANES.map((lane) => ({
    label: lane.label,
    champion: "",
    ...emptyStats(),
  }));
}

function rowToPayload(
  row: OurRow | EnemyRow,
  position: string,
  laneIndex: number,
  itemIds: number[],
) {
  const champion = row.champion.trim();
  if (!champion) return null;

  const keystone = Number.parseInt(row.keystoneId, 10);
  const primaryStyle = Number.parseInt(row.primaryStyleId, 10);
  const subStyle = Number.parseInt(row.subStyleId, 10);
  const runeSlots = Number.isFinite(keystone) ? [keystone] : [];
  const perks =
    runeSlots.length > 0 || Number.isFinite(primaryStyle) || Number.isFinite(subStyle)
      ? {
          slots: runeSlots,
          primaryStyle: Number.isFinite(primaryStyle) ? primaryStyle : undefined,
          subStyle: Number.isFinite(subStyle) ? subStyle : undefined,
        }
      : undefined;

  const spell1 = Number.parseInt(row.spell1Id, 10);
  const spell2 = Number.parseInt(row.spell2Id, 10);
  const rawBuild: ParticipantBuild | null =
    itemIds.length > 0 || row.spell1Id.trim() || row.spell2Id.trim() || perks
      ? {
          itemIds,
          spell1Id: Number.isFinite(spell1) ? spell1 : undefined,
          spell2Id: Number.isFinite(spell2) ? spell2 : undefined,
          perks,
        }
      : null;

  const build = finalizeParticipantBuild(rawBuild, {
    position,
    laneIndex,
    scoreboardRole: scoreboardRoleForLaneIndex(laneIndex),
  });

  const base = {
    champion,
    position,
    kills: row.kills || undefined,
    deaths: row.deaths || undefined,
    assists: row.assists || undefined,
    cs: row.cs || undefined,
    damage: row.damage || undefined,
    goldEarned: row.goldEarned || undefined,
    visionScore: row.visionScore || undefined,
    build,
  };

  if ("playerId" in row) {
    if (!row.playerId) return null;
    return { ...base, playerId: row.playerId };
  }

  return {
    ...base,
    label: row.label.trim() || undefined,
  };
}

function StatInputs({
  row,
  onChange,
  compact,
  itemLookup,
  itemSlots,
  spellLookup,
  keystoneOptions,
}: {
  row: StatFields;
  onChange: (patch: Partial<StatFields>) => void;
  compact?: boolean;
  itemLookup: ItemLookup | null;
  itemSlots: number;
  spellLookup: SpellLookup | null;
  keystoneOptions: KeystoneOption[];
}) {
  const grid = compact
    ? "grid grid-cols-3 gap-2 sm:grid-cols-6"
    : "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8";

  const field = (key: keyof StatFields, label: string, placeholder?: string) => (
    <label key={key} className="block text-[10px] text-muted">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={row[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        className="mt-0.5 w-full min-w-0"
      />
    </label>
  );

  return (
    <div className="space-y-2">
      <div className={grid}>
        {field("kills", "K")}
        {field("deaths", "D")}
        {field("assists", "A")}
        {field("cs", "CS")}
        {field("damage", "DMG")}
        {field("goldEarned", "Gold")}
        {field("visionScore", "Vis")}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: itemSlots }).map((_, idx) => (
          <label key={idx} className="block text-[10px] text-muted">
            Item {idx + 1}
            <input
              value={row.itemSlots[idx] ?? ""}
              onChange={(e) => {
                const next = [...row.itemSlots];
                next[idx] = e.target.value;
                onChange({ itemSlots: next });
              }}
              placeholder={itemLookup ? "Item name / ID" : "ID"}
              list="match-item-options"
              className="mt-0.5 w-full min-w-0"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block text-[10px] text-muted">
          Spell 1
          <select
            value={row.spell1Id}
            onChange={(e) => onChange({ spell1Id: e.target.value })}
            className="mt-0.5 w-full"
          >
            <option value="">—</option>
            {(spellLookup?.options ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-muted">
          Spell 2
          <select
            value={row.spell2Id}
            onChange={(e) => onChange({ spell2Id: e.target.value })}
            className="mt-0.5 w-full"
          >
            <option value="">—</option>
            {(spellLookup?.options ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block text-[10px] text-muted">
          Trinket
          <input
            value={row.trinketId}
            onChange={(e) => onChange({ trinketId: e.target.value })}
            placeholder={itemLookup ? "Trinket name / ID" : "ID"}
            list="match-item-options"
            className="mt-0.5 w-full"
          />
        </label>
        <label className="block text-[10px] text-muted">
          Primary keystone
          <select
            value={row.keystoneId}
            onChange={(e) => {
              const keystoneId = e.target.value;
              const selected = keystoneOptions.find((k) => String(k.id) === keystoneId);
              onChange({
                keystoneId,
                primaryStyleId: selected ? String(selected.styleId) : "",
              });
            }}
            className="mt-0.5 w-full"
          >
            <option value="">—</option>
            {keystoneOptions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-muted">
          Secondary rune tree
          <select
            value={row.subStyleId}
            onChange={(e) => onChange({ subStyleId: e.target.value })}
            className="mt-0.5 w-full"
          >
            <option value="">—</option>
            {RUNE_STYLE_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function goToMatches(matchId?: string) {
  const path = matchId ? `/matches?added=${matchId}` : "/matches";
  window.location.assign(path);
}

export function ManualMatchForm({
  players,
  matchId,
  initial,
}: {
  players: RosterPlayerOption[];
  matchId?: string;
  initial?: ManualMatchFormInitial;
}) {
  const [date, setDate] = useState(() => initial?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(() => initial?.time ?? formatTime24(new Date()));
  const [gameDuration, setGameDuration] = useState(() => initial?.gameDuration ?? "");
  const [league, setLeague] = useState<string>(initial?.league ?? COMPETITIONS[2].league);
  const [customLeague, setCustomLeague] = useState("");
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [result, setResult] = useState<MatchResult>(initial?.result ?? "WIN");
  const [side, setSide] = useState<Side>(initial?.side ?? "BLUE");
  const [gameType, setGameType] = useState<GameType>(initial?.gameType ?? "SCRIM");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ourRows, setOurRows] = useState<OurRow[]>(() => initial?.ourRows ?? defaultOurRows(players));
  const [enemyRows, setEnemyRows] = useState<EnemyRow[]>(() => initial?.enemyRows ?? defaultEnemyRows());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemLookup, setItemLookup] = useState<ItemLookup | null>(null);
  const [spellLookup, setSpellLookup] = useState<SpellLookup | null>(null);
  const [keystoneOptions, setKeystoneOptions] = useState<KeystoneOption[]>(
    FALLBACK_KEYSTONE_OPTIONS,
  );

  const leagueValue = league === "__custom__" ? customLeague.trim() : league;

  const rosterById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = (json?.data ?? {}) as Record<
          string,
          { name?: string }
        >;
        const options = Object.entries(data)
          .map(([id, value]) => ({ id: Number(id), name: value.name ?? id }))
          .filter((v) => Number.isFinite(v.id) && !!v.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        setItemLookup({ options, byName: buildItemNameLookup(options) });
      })
      .catch(() => {
        // Keep form usable even when Data Dragon fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/summoner.json`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = (json?.data ?? {}) as Record<
          string,
          { key?: string; name?: string }
        >;
        const options = Object.values(data)
          .map((value) => ({
            id: Number(value.key ?? 0),
            name: value.name ?? "",
          }))
          .filter(
            (v) =>
              Number.isFinite(v.id) &&
              v.id > 0 &&
              !!v.name &&
              RENDERABLE_SUMMONER_SPELL_IDS.has(v.id),
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        setSpellLookup({ options });
      })
      .catch(() => {
        // Keep form usable even when spell list fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/runesReforged.json`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !Array.isArray(json)) return;
        const options: KeystoneOption[] = [];
        for (const style of json as Array<{
          id?: number;
          slots?: Array<{ runes?: Array<{ id?: number; name?: string }> }>;
        }>) {
          const styleId = Number(style.id ?? 0);
          const runes = style.slots?.[0]?.runes ?? [];
          for (const rune of runes) {
            const id = Number(rune.id ?? 0);
            const label = String(rune.name ?? "").trim();
            if (!Number.isFinite(styleId) || styleId <= 0) continue;
            if (!Number.isFinite(id) || id <= 0 || !label) continue;
            options.push({ id, label, styleId });
          }
        }
        if (options.length > 0) {
          options.sort((a, b) => a.label.localeCompare(b.label));
          setKeystoneOptions(options);
        }
      })
      .catch(() => {
        // Keep form usable with fallback keystones when fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateOurRow(index: number, patch: Partial<OurRow>) {
    setOurRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function updateEnemyRow(index: number, patch: Partial<EnemyRow>) {
    setEnemyRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const unknownItems: string[] = [];
    const normalizedOurRows = ourRows.map((row) => {
      const ids: number[] = [];
      const unknown: string[] = [];
      for (const slot of row.itemSlots) {
        const { ids: slotIds, unknown: slotUnknown } = parseItemInput(
          slot,
          itemLookup?.byName ?? null,
        );
        ids.push(...slotIds);
        unknown.push(...slotUnknown);
      }
      const trinketInput = row.trinketId.trim();
      if (trinketInput) {
        const { ids: trinketIds, unknown: trinketUnknown } = parseItemInput(
          trinketInput,
          itemLookup?.byName ?? null,
        );
        ids.push(...trinketIds);
        unknown.push(...trinketUnknown);
      }
      unknownItems.push(...unknown);
      return { ...row, itemSlots: ids.map(String), trinketId: "" };
    });
    const normalizedEnemyRows = enemyRows.map((row) => {
      const ids: number[] = [];
      const unknown: string[] = [];
      for (const slot of row.itemSlots) {
        const { ids: slotIds, unknown: slotUnknown } = parseItemInput(
          slot,
          itemLookup?.byName ?? null,
        );
        ids.push(...slotIds);
        unknown.push(...slotUnknown);
      }
      const trinketInput = row.trinketId.trim();
      if (trinketInput) {
        const { ids: trinketIds, unknown: trinketUnknown } = parseItemInput(
          trinketInput,
          itemLookup?.byName ?? null,
        );
        ids.push(...trinketIds);
        unknown.push(...trinketUnknown);
      }
      unknownItems.push(...unknown);
      return { ...row, itemSlots: ids.map(String), trinketId: "" };
    });
    if (unknownItems.length > 0) {
      setLoading(false);
      setError(
        `Unknown item names: ${Array.from(new Set(unknownItems)).join(", ")}`,
      );
      return;
    }

    const ourParticipants = LANES.map((lane, i) => {
      const ids: number[] = [];
      for (const slot of ourRows[i].itemSlots) {
        const { ids: slotIds } = parseItemInput(slot, itemLookup?.byName ?? null);
        ids.push(...slotIds);
      }
      const trinketInput = ourRows[i].trinketId.trim();
      if (trinketInput) {
        const { ids: trinketIds } = parseItemInput(trinketInput, itemLookup?.byName ?? null);
        ids.push(...trinketIds);
      }
      return rowToPayload(ourRows[i], lane.position, i, ids);
    }).filter(Boolean);

    const enemyParticipants = LANES.map((lane, i) => {
      const ids: number[] = [];
      for (const slot of enemyRows[i].itemSlots) {
        const { ids: slotIds } = parseItemInput(slot, itemLookup?.byName ?? null);
        ids.push(...slotIds);
      }
      const trinketInput = enemyRows[i].trinketId.trim();
      if (trinketInput) {
        const { ids: trinketIds } = parseItemInput(trinketInput, itemLookup?.byName ?? null);
        ids.push(...trinketIds);
      }
      return rowToPayload(enemyRows[i], lane.position, i, ids);
    }).filter(Boolean);

    const payload = {
      date,
      time,
      league: leagueValue,
      opponent: opponent.trim(),
      gameDuration,
      result,
      side,
      gameType,
      notes: notes.trim() || undefined,
      ourParticipants,
      enemyParticipants,
    };

    const res = await fetch(matchId ? `/api/matches/${matchId}` : "/api/matches", {
      method: matchId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await res.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;

    setLoading(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not save match");
      return;
    }

    goToMatches(body?.id ?? matchId);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <ChampionDatalist />
      <datalist id="match-item-options">
        {(itemLookup?.options ?? []).map((item) => (
          <option key={item.id} value={item.name} label={`${item.id}`} />
        ))}
      </datalist>
      <section className="space-y-4 rounded-xl border border-border bg-surface/30 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Match info
        </h2>

        <div className="flex flex-wrap gap-2">
          {(["WIN", "LOSS"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResult(r)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                result === r
                  ? r === "WIN"
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : "border-rose-500/50 bg-rose-500/15 text-rose-300"
                  : "border-border bg-inset/60 text-muted hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(["BLUE", "RED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                side === s
                  ? s === "BLUE"
                    ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
                    : "border-rose-500/50 bg-rose-500/15 text-rose-300"
                  : "border-border bg-inset/60 text-muted hover:text-foreground"
              }`}
            >
              Our side: {s}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-muted">
            Opponent
            <input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
              placeholder="Team name"
              className="mt-1 w-full"
            />
          </label>

          <label className="block text-xs text-muted">
            League
            <select
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="mt-1 w-full"
            >
              {LEAGUE_PRESETS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
          </label>

          {league === "__custom__" && (
            <label className="block text-xs text-muted">
              Custom league
              <input
                value={customLeague}
                onChange={(e) => setCustomLeague(e.target.value)}
                required
                className="mt-1 w-full"
              />
            </label>
          )}

          <label className="block text-xs text-muted">
            Game type
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value as GameType)}
              className="mt-1 w-full"
            >
              <option value="OFFICIAL">Official</option>
              <option value="SCRIM">Scrim</option>
              <option value="TRAINING">Training</option>
            </select>
          </label>

          <label className="block text-xs text-muted">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 w-full"
            />
          </label>

          <label className="block text-xs text-muted">
            Time
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={(e) => {
                const normalized = normalizeTime24Input(e.target.value);
                if (normalized) setTime(normalized);
              }}
              required
              inputMode="numeric"
              pattern={TIME_24_PATTERN.source}
              placeholder="14:00"
              className="mt-1 w-full"
            />
            <span className="mt-1 block text-[10px] text-faint">24h format (HH:mm)</span>
          </label>

          <label className="block text-xs text-muted">
            Game time (mm:ss)
            <input
              type="text"
              value={gameDuration}
              onChange={(e) => setGameDuration(e.target.value)}
              placeholder="24:54"
              pattern="^([0-9]{1,2}):([0-5][0-9])$"
              inputMode="numeric"
              className="mt-1 w-full"
            />
            <span className="mt-1 block text-[10px] text-faint">
              Optional, used for CS/min.
            </span>
          </label>

        </div>

        <label className="block text-xs text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-y"
            placeholder="Optional"
          />
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface/30 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-300">
          Our team
        </h2>
        <p className="text-xs text-muted">
          Fill champions and stats per lane. Leave a row empty to skip that player.
        </p>

        <div className="space-y-6">
          {LANES.map((lane, i) => (
            <div
              key={lane.label}
              className="rounded-lg border border-border/80 bg-inset/20 p-3 sm:p-4"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {lane.label}
              </p>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted">
                  Player
                  <select
                    value={ourRows[i].playerId}
                    onChange={(e) =>
                      updateOurRow(i, { playerId: e.target.value })
                    }
                    className="mt-1 w-full"
                  >
                    <option value="">—</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                        {p.summonerName ? ` (${p.summonerName})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-muted">
                  Champion
                  <ChampionInput
                    value={ourRows[i].champion}
                    onChange={(champion) => updateOurRow(i, { champion })}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
              {ourRows[i].playerId && ourRows[i].champion && (
                <StatInputs
                  row={ourRows[i]}
                  onChange={(patch) => updateOurRow(i, patch)}
                  itemLookup={itemLookup}
                  itemSlots={lane.position === "BOTTOM" ? 7 : 6}
                  spellLookup={spellLookup}
                  keystoneOptions={keystoneOptions}
                />
              )}
              {ourRows[i].playerId && (
                <p className="mt-2 text-[10px] text-faint">
                  {rosterById.get(ourRows[i].playerId)?.teamRole ?? "—"} ·{" "}
                  {lane.position}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface/30 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-300">
          Enemy team
        </h2>
        <p className="text-xs text-muted">
          Optional — add enemy laners for a full scoreboard.
        </p>

        <div className="space-y-6">
          {LANES.map((lane, i) => (
            <div
              key={`enemy-${lane.label}`}
              className="rounded-lg border border-border/80 bg-inset/20 p-3 sm:p-4"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {lane.label}
              </p>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted">
                  Name / label
                  <input
                    value={enemyRows[i].label}
                    onChange={(e) => updateEnemyRow(i, { label: e.target.value })}
                    placeholder="Enemy top"
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block text-xs text-muted">
                  Champion
                  <ChampionInput
                    value={enemyRows[i].champion}
                    onChange={(champion) => updateEnemyRow(i, { champion })}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
              {enemyRows[i].champion.trim() && (
                <StatInputs
                  row={enemyRows[i]}
                  onChange={(patch) => updateEnemyRow(i, patch)}
                  itemLookup={itemLookup}
                  itemSlots={lane.position === "BOTTOM" ? 7 : 6}
                  spellLookup={spellLookup}
                  keystoneOptions={keystoneOptions}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : matchId ? "Update match" : "Save match"}
        </button>
        <Link href="/matches" className="btn-ghost">
          Cancel
        </Link>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </form>
  );
}
