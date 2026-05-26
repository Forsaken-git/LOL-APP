# LCU spectate collector

Capture scrim/official games while **spectating through the League client** and push them into Renim A. automatically.

Uses:

- **LCU** (League Client Update API) — lockfile auth on the open LoL client
- **Live Client Data** (`127.0.0.1:2999`) — active spectator game client
- **EOG stats block** — full stats, picks/bans when the game ends

No Riot API key required for local spectating.

## Requirements

- **League of Legends client** must be running and logged in (click **Play** on LoL in Riot Client).
- The Riot Client alone is **not** enough — it does not create the League lockfile.
- While spectating, the **spectator game window** must run (Live Client on port `2999`).

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

Then start spectating a game (in-client spectate code, tournament observer, or `launch` below).

When the spectator game client closes, the tool:

1. Reads `/lol-end-of-game/v1/eog-stats-block` from LCU
2. Writes `data/exports/lcu-{gameId}.json`
3. POSTs to `/api/ingest` if `pushOnComplete` is true

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

# One-shot export from current EOG screen (client on post-game)
npm run lcu:export -- --push
```

## Typical workflow (analyst)

1. `npm run dev` + `npm run lcu:watch`
2. Spectate the scrim in the LoL client

Finished games are saved as JSON under `data/exports/` (even when `pushOnComplete` is false). Import them later:

```bash
npm run ingest:exports
```
3. When the game ends, close the spectator window (or let it exit)
4. Collector pushes the match → team refreshes Renim A.

## Config reference

| Field | Purpose |
|--------|---------|
| `teamSummoners` | Who counts as your team (for W/L side + participants) |
| `roster` | Hub player ids and roles |
| `opponent` | Fixed opponent name; if omitted, derived from enemy summoners |
| `league` / `gameType` | Stored on the match (`SCRIM`, `OFFICIAL`, …) |
| `pushOnComplete` | POST to hub after each game |
| `exportDir` | Local JSON backup folder |

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Lockfile not found | Click **Play** on League in Riot Client and log in; `watch` will connect when the lockfile appears |
| Only Riot Client running | Same — launch the actual LoL client; lockfile path is `%LOCALAPPDATA%\Riot Games\League of Legends\lockfile` |
| No EOG block | Stay on post-game briefly; run `npm run lcu:export -- --push` manually |
| Wrong team / LOSS | Check `teamSummoners` tags match in-game names |
| Hub 401 | Set `INGEST_API_KEY` in `.env` and export it in the shell |
| Live client never “up” | Spectator game window must be running (port 2999) |

## Limitations

- Pick/ban **order** is approximate (bans then picks per team from EOG).
- Spectator delay applies to live data (same as watching in client).
- Custom/tournament games need valid spectate credentials.
- Unsupported by Riot — LCU endpoints can change between patches.

See also: [INGEST.md](./INGEST.md) for payload shape.
