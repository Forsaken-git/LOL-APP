# LCU spectate collector

Capture scrim/official games while **spectating through the League client** and push them into Renim A. automatically.

Uses:

- **LCU** (League Client Update API) — lockfile auth on the open LoL client
- **Live Client Data** (`127.0.0.1:2999`) — active spectator game client
- **EOG stats block** — full stats, picks/bans when the game ends

No Riot API key required for local spectating.

## Requirements

- **League of Legends client** must be running and logged in (click **Play** on LoL in Riot Client).
- The Riot Client alone is **not** enough — it does not expose EOG stats.
- While spectating, the **spectator game window** must run (Live Client on port `2999`).

On many Windows installs the League lockfile is under the game folder, not AppData:

`C:\Riot Games\League of Legends\lockfile`

Set `LCU_LOCKFILE` or `LEAGUE_INSTALL_DIR` if yours is elsewhere.

## Setup

1. Copy the config template:

   ```bash
   copy data\lcu-spectate.config.example.json data\lcu-spectate.config.json
   ```

2. Edit `data/lcu-spectate.config.json`:
   - `teamSummoners` — every summoner on **your** team (`Name#TAG`)
   - `roster` — maps summoners to `externalId` / roles for the hub
   - `league`, `gameType`, `platformId`, `hubUrl`

3. Start Renim A. locally:

   ```bash
   npm run dev
   ```

## Watch mode (recommended)

Open the **League client** and log in. In a second terminal:

```bash
npm run lcu:watch
```

**Start `lcu:watch` before champion select** if you want the full competitive pick/ban order (20 turns: 6 bans + 10 picks, same as the hub Drafter). The collector polls `/lol-champ-select/v1/session` while `gameflow` is `ChampSelect` and logs each completed ban/pick. Those rows are attached to the match when EOG is saved (instead of the approximate post-game list).

Requirements for draft capture:

- The **same League client** must see champ select (in lobby on a team account, or custom/tournament flow with LCU access). Spectating only **after** draft still captures stats, but not the live draft order.
- Set `"captureChampSelectDraft": true` in config (default).

During draft you will see lines like `[draft]   1. BLUE BAN  …`. When all 20 turns are done: `[draft] All 20 turns recorded`. A backup is written to `data/exports/draft-latest.json`.

Then spectate the game (in-client spectate code, tournament observer, or `launch` below).

The collector:

1. Records champ select pick/ban order when enabled (see above)
2. Detects an active spectator session (live client on port 2999)
2. When the game ends (live client closes, `GameEnd` event, or LCU post-game phase), enters **EOG hunt** — polls `/lol-end-of-game/v1/eog-stats-block` every 0.5s for up to 2 minutes
3. Validates the block (10 players, stats present), builds ingest JSON, writes `data/exports/lcu-{gameId}.json`
4. Optionally writes a one-line JSONL backup (`game_data_*.jsonl`) for `npm run ingest:jsonl`
5. POSTs to `/api/ingest` when `pushOnComplete` is true

You do **not** need to time closing the spectator window perfectly — stay on the League client post-game screen if capture is slow.

Refresh Renim A. — the match appears on Overview / Matches.

## Launch spectate from CLI

If you have **game id**, **platform**, and **encryption key** (from tournament observer / custom lobby):

```bash
npm run lcu:launch -- --game-id 7123456789 --key "YOUR_KEY" --platform EUW1
```

Run `lcu:watch` in another terminal to capture the result.

## Other commands

```bash
# LCU + live client health check
npm run lcu:status

# Poll until EOG is complete, then export (and --push)
npm run lcu:export -- --push
```

## Typical workflow (analyst)

1. `npm run dev` + `npm run lcu:watch`
2. Spectate the scrim in the LoL client
3. When the game ends, leave the League client on post-game / stats briefly if needed
4. Collector logs `[saved]` and `[hub]` → team refreshes Renim A.

Finished games are saved under `data/exports/`. Import later:

```bash
npm run ingest:exports
# or JSONL backup lines:
npm run ingest:jsonl -- path/to/game_data_*.jsonl
```

## Config reference

| Field | Purpose |
|--------|---------|
| `teamSummoners` | Who counts as your team (for W/L side + participants) |
| `roster` | Hub player ids and roles |
| `opponent` | Fixed opponent name; if omitted, derived from enemy summoners |
| `league` / `gameType` | Stored on the match (`SCRIM`, `OFFICIAL`, …) |
| `pushOnComplete` | POST to hub after each game |
| `exportDir` | Local JSON backup folder |
| `pollIntervalSec` | Idle/live polling interval (default 2) |
| `eogPollIntervalSec` | EOG hunt poll interval (default 0.5) |
| `postGameTimeoutSec` | Max seconds to wait for complete EOG (default 120) |
| `saveJsonlBackup` | Write `game_data_*.jsonl` on success (default true) |

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Lockfile not found | Launch League from Riot Client; check `C:\Riot Games\League of Legends\lockfile` or set `LCU_LOCKFILE` |
| Only Riot Client running | Open the actual LoL client (Play button) |
| No EOG block / timeout | Stay on post-game in League client; run `npm run lcu:export -- --push` |
| Phase already `Lobby` | EOG may be gone — spectate again or import JSONL if backup exists |
| Wrong team / LOSS | Check `teamSummoners` tags match in-game names |
| Hub 401 | Set `INGEST_API_KEY` in `.env` and export it in the shell |
| Live client never “up” | Spectator game window must be running (port 2999) |

## Full stats (items, runes, vision, …)

After a game ends, the collector reads the full **EOG stats block** and maps:

- KDA, CS, damage, gold, vision score  
- Item IDs (6 + trinket), summoner spell IDs, rune perk IDs  
- All 10 players (your roster + opponents)  
- Match duration (`gameLength`)

Debug what your client returns:

```bash
npm run lcu:inspect-eog
```

See [COLLECTOR-DATA.md](./COLLECTOR-DATA.md) for field mapping and ingest JSON.

## Limitations

- Pick/ban **order** from EOG alone is approximate (bans then picks per team). Use champ-select capture for the real sequence.
- Rune **icons** are stored as IDs; scoreboard shows items + spells first.
- Live snapshot fallback has partial build data if EOG is missing.
- Spectator delay applies to live data (same as watching in client).
- Custom/tournament games need valid spectate credentials.
- Unsupported by Riot — LCU endpoints can change between patches.

See also: [INGEST.md](./INGEST.md) for payload shape.
