# Collector data — full match stats

Renim A. stores rich post-game data when your collector sends the **LCU end-of-game block** (`/lol-end-of-game/v1/eog-stats-block`). That is the same payload embedded in `game_data_*.jsonl` as `sources.lcu_eog_stats`.

## Scoreboard checklist

| What you need | Stored in DB / export | Source | Notes |
|---------------|----------------------|--------|-------|
| Player name | `displayName`, `summonerName` | `riotIdGameName` / `summonerName` | Ingest uses game name (no tag in display) |
| Champion (image key) | `champion` | `championName` + DDragon via `championId` | Normalized with `championDisplayName()` on ingest |
| Summoner spells | `buildJson.spell1Id`, `spell2Id` | EOG player root | |
| Runes | `buildJson.perks` | `PERK0`–`PERK5`, `PERK_PRIMARY_STYLE`, `PERK_SUB_STYLE` | |
| Items (6 slots) | `buildJson.itemIds` | `stats.ITEM0`–`ITEM7` | Boots/pet/trinket stripped out |
| Trinket | `buildJson.trinketItemId` | ITEM slots / `items[]` | |
| Quest (ADC boots, JG pet, lane/support) | `buildJson.questItemId` | ITEM slots | JG pets `1101`–`1107`, lane `1205`–`1221`, support `3850`+ |
| K/D/A | `kills`, `deaths`, `assists` | EOG stats | |
| KP% | *(not stored)* | — | Scoreboard computes from all 10 players’ K/D/A |
| CS | `cs` | `MINIONS_KILLED` + `NEUTRAL_MINIONS_KILLED` | |
| CS/min | *(not stored)* | — | `cs ÷ (gameDurationSec / 60)` in UI |
| Damage | `damage` | `TOTAL_DAMAGE_DEALT_TO_CHAMPIONS` | |
| Gold | `goldEarned` | `GOLD_EARNED` | |
| Game length | `gameDurationSec` | `gameLength` | Required for CS/min |
| Vision | `visionScore` | `VISION_SCORE` | Optional |

Validation runs on export (`[warn] Extracted match missing fields`) and on hub ingest (`[ingest] incomplete collector data`).

## What you get per player (EOG)

| Hub field | LCU source |
|-----------|------------|
| K/D/A | `stats.CHAMPIONS_KILLED`, `NUM_DEATHS`, `ASSISTS` |
| CS | `MINIONS_KILLED` + `NEUTRAL_MINIONS_KILLED` |
| Damage | `TOTAL_DAMAGE_DEALT_TO_CHAMPIONS` |
| Gold | `stats.GOLD_EARNED` |
| Vision | `stats.VISION_SCORE` |
| Lane | `detectedTeamPosition` |
| Items | `stats.ITEM0`–`ITEM7` (slot order, incl. ADC boots + trinket), then `items[]` fallback |
| Summoner spells | `spell1Id`, `spell2Id` |
| Runes | `stats.PERK0`–`PERK5`, `PERK_PRIMARY_STYLE`, `PERK_SUB_STYLE` → stored in `buildJson` |

| Match field | LCU source |
|-------------|------------|
| Duration | `gameLength` (seconds) |
| Bans | `teams[].championBans` |
| Picks | player `championId` / `championName` |

Opponents are included when the mapper/JSONL adapter sends `opponent: true` on their participant rows.

## Tools in this repo

| Command | Role |
|---------|------|
| `npm run lcu:watch` | Spectate + capture EOG → `data/exports/` + optional hub POST |
| `npm run lcu:export -- --push` | One-shot EOG export |
| `npm run lcu:inspect-eog` | Print EOG keys + validate extracted payload (after a game) |
| `npm run ingest:jsonl -- file.jsonl --local` | Import a JSONL log into SQLite |

Shared extraction logic:

- TypeScript: `src/lib/ingest/eog-player.ts`, validation: `src/lib/ingest/collector-validate.ts`
- Python: `scripts/lcu_spectate/eog_extract.py`, `eog_validate.py`

Keep `scripts/lcu_spectate/item_slots.py` in sync with `src/lib/build-normalize.ts` and `src/lib/items.ts`.

## Ingest JSON shape (participants)

```json
{
  "participants": [
    {
      "playerExternalId": "player-nova",
      "displayName": "Nova",
      "summonerName": "Nova#EUW",
      "champion": "Renekton",
      "kills": 4,
      "deaths": 1,
      "assists": 7,
      "cs": 187,
      "damage": 24500,
      "goldEarned": 12833,
      "visionScore": 15,
      "position": "TOP",
      "build": {
        "itemIds": [3075, 1038, 3068, 3071, 3065],
        "questItemId": 3047,
        "trinketItemId": 3340,
        "spell1Id": 4,
        "spell2Id": 12,
        "perks": {
          "primaryStyle": 8400,
          "subStyle": 8300,
          "slots": [8465, 8446, 8473, 8242, 9104, 8009]
        }
      }
    }
  ],
  "gameDurationSec": 1842
}
```

`build` is persisted as `buildJson` on `MatchParticipant`. Re-ingest with the same `externalId` to refresh.

**ADC boots:** boots go in `questItemId`, not the six-item grid.

**Jungle pet:** smite pets `1101`–`1107` go in `questItemId` (same slot as lane quest on scoreboard).

## Live snapshot fallback (partial)

If EOG never appears, `lcu:watch` may save a **live client** snapshot. That path is incomplete: often no runes, no trinket/quest split, missing damage/gold/duration. Prefer staying on the post-game screen until EOG validates. Warnings are printed when fields are missing.

## If your JSONL tool is separate

Ensure each game line includes **`sources.lcu_eog_stats`** with the full EOG object (not a trimmed summary). Poll interval can be sparse; only the **last** EOG line per file is used on import.

## UI

The match scoreboard shows **vision**, **match duration**, **item + spell icons** when `buildJson` is present. KP% and CS/min are computed at display time.

## Patch checklist

After changing `prisma/schema.prisma`:

```bash
npm run db:push
```

Restart `npm run dev` if Prisma client generation was locked.
