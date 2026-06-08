# Data ingest API (for your collector script)

The hub reads everything from the database. Your script should **POST JSON** to sync players, matches, picks/bans, and calendar events. The UI updates on refresh (all pages load live data).

## Authentication

Set in `.env`:

```
INGEST_API_KEY=your-secret-key-here
```

Send on every request:

```
x-api-key: your-secret-key-here
```

In local dev, if `INGEST_API_KEY` is unset, ingest is **open** (no key required). In production, the key is **required**.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/ingest` | Bulk sync (players, matches, events) |
| `GET` | `/api/ingest` | Counts + last sync status |
| `PUT` | `/api/ingest/match/{externalId}` | Upsert one match by id |
| `DELETE` | `/api/ingest/match/{externalId}` | Remove a match |

## Idempotent upserts

Use stable **`externalId`** fields so re-running your script updates instead of duplicating:

- **Match** — e.g. Riot match id: `EUW1_7123456789`
- **Player** — e.g. PUUID or `summonerName` slug: `player-nova`
- **Event** — e.g. `scrim-2026-05-28`

Re-sending the same `externalId` replaces pick/bans and participants for that match.

## Payload shape

See `data/example-export.json` for a full example. For KDA, CS, vision, items, runes, and spells from LCU, see [COLLECTOR-DATA.md](./COLLECTOR-DATA.md).

```json
{
  "source": "my-script-v1",
  "players": [
    {
      "externalId": "player-nova",
      "displayName": "Nova",
      "summonerName": "Nova#EUW",
      "teamRole": "TOP",
      "memberRole": "PLAYER"
    }
  ],
  "matches": [
    {
      "externalId": "EUW1_7123456789",
      "playedAt": "2026-05-24T19:30:00.000Z",
      "league": "Regional League",
      "opponent": "Phoenix Esports",
      "result": "WIN",
      "side": "BLUE",
      "gameType": "OFFICIAL",
      "mvpExternalId": "player-spark",
      "participants": [
        {
          "playerExternalId": "player-nova",
          "champion": "Renekton",
          "kills": 4,
          "deaths": 1,
          "assists": 7
        }
      ],
      "pickBans": [
        { "champion": "Kalista", "type": "BAN", "side": "RED", "order": 0 }
      ]
    }
  ],
  "events": []
}
```

### Enums

- `result`: `WIN` | `LOSS`
- `side`: `RED` | `BLUE`
- `gameType`: `OFFICIAL` | `TRAINING` | `SCRIM`
- `type` (pick/ban): `PICK` | `BAN`
- `teamRole`: `TOP` | `JUNGLE` | `MID` | `ADC` | `SUPPORT` | `FILL`
- `memberRole`: `PLAYER` | `SUB` | `MANAGER` | `COACH` | `ANALYTICS`
- Event `type`: `MATCH` | `TRAINING` | `SCRIM` | `MEETING` | `OTHER`

### Participant lookup

Each participant needs **one** of:

- `playerExternalId` (recommended)
- `displayName`
- `summonerName`

Unknown names auto-create a player row.

## Push from your script

### Python

```bash
pip install  # stdlib only
export INGEST_API_KEY=your-secret
python scripts/push_ingest.py data/export.json
```

### Node (while dev server runs)

```bash
npm run ingest -- data/example-export.json
```

### JSON from another tool (folder per competition)

Place files under:

- `data/import/cwl/`
- `data/import/scrims/`
- `data/import/titans league/`
- `data/import/officials/`

Place **hub-format `.json`** files only (see `data/example-export.json`).

Then:

```bash
npm run ingest:teams -- --dry-run        # preview
npm run ingest:teams -- --local          # write to DB
npm run ingest:teams -- data/import --local
```

League and game type are inferred from the folder name.

Inspect one file: `npm run ingest:inspect -- data/import/cwl/game.json --try`

See [`data/import/README.md`](../data/import/README.md) for field aliases.

### Import saved JSON files (LCU exports folder)

The LCU spectate collector saves one file per game under `data/exports/` (see `exportDir` in `data/lcu-spectate.config.json`). To load **all** of them into the hub:

```bash
# Direct to database — dev server not required
npm run ingest:exports

# Same, explicit path
npm run ingest:bulk -- data/exports --local

# Preview merge counts only
npm run ingest:bulk -- data/exports --dry-run

# POST to a running app instead
npm run ingest:bulk -- data/exports
```

You can pass a **folder** or one or more **`.json` files**. Each file can be:

- A full hub export (`players`, `matches`, `events`) — see `data/example-export.json`
- An LCU per-game export (`matches: [ … ]` with one game) — same shape the spectate script POSTs

Duplicates are merged by `externalId` (matches/players/events) before import.

### curl

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INGEST_API_KEY" \
  -d @data/example-export.json
```

## Typical collector workflow

1. Script runs on a schedule (after scrims / officials).
2. Builds `export.json` with new/updated matches since last run.
3. POSTs to `/api/ingest` (or PUT per match).
4. Team opens the hub — stats, picks/bans, and match list reflect new data.

## Response

```json
{
  "success": true,
  "source": "my-script",
  "players": { "created": 0, "updated": 2 },
  "matches": { "created": 1, "updated": 0 },
  "events": { "created": 0, "updated": 0 },
  "errors": []
}
```

HTTP `207` means partial success (check `errors`).
