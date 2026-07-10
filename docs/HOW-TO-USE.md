# How to use Renim A.

Step-by-step guide for analysts: run the website on Vercel, add your roster there, and capture scrims from your PC with the LCU watcher.

---

## What runs where

| Part | Where it runs | What it does |
|------|----------------|--------------|
| **Website** | Vercel (`https://lol-app-blush.vercel.app`) | Roster, matches, calendar, draft tools |
| **Database** | Turso (cloud) | Stores everything the site shows |
| **LCU watcher** | Your PC (`npm run lcu:watch`) | Reads League Client while you spectate, pushes finished games to Vercel |

The watcher cannot run on Vercel — it needs direct access to the League client on your machine.

---

## 1. Website (one-time setup)

### Vercel environment variables

In [vercel.com](https://vercel.com) → your project → **Settings → Environment Variables**, set:

| Name | Purpose |
|------|---------|
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso read-write token |
| `DATABASE_URL` | `file:./dev.db` (dummy for Prisma build) |
| `INGEST_API_KEY` | Secret for pushing match data (required in production) |

Generate a key:

```powershell
openssl rand -hex 32
```

Save the same value locally — you will need it for the LCU watcher (step 3).

Redeploy after changing env vars.

More detail: [GITHUB.md](./GITHUB.md).

---

## 2. Add your team on the website

1. Open your Vercel URL (e.g. `https://lol-app-blush.vercel.app`).
2. Go to **Players** and add each player.
3. Enter each **Riot ID** exactly as in-game (`Name#TAG`).

This is the **roster source of truth**. You do **not** need to list players in `lcu-spectate.config.json` when `syncRosterFromHub` is `true` (default).

The watcher pulls this list automatically from:

`GET /api/players/lcu-roster`

---

## 3. LCU watcher (your PC)

### Requirements

- Windows PC with **League of Legends** installed
- Node.js + Python (same repo clone as the app)
- League client open and logged in (click **Play** in Riot Client — Riot Client alone is not enough)
- Spectator game window running while you watch (Live Client on port `2999`)

### Config file

Copy the template if you have not already:

```powershell
copy data\lcu-spectate.config.example.json data\lcu-spectate.config.json
```

Minimal config (roster comes from the website):

```json
{
  "hubUrl": "https://lol-app-blush.vercel.app",
  "syncRosterFromHub": true,
  "league": "Scrim",
  "gameType": "SCRIM",
  "platformId": "EUW1",
  "pushOnComplete": true,
  "captureChampSelectDraft": true
}
```

| Field | What to set |
|-------|-------------|
| `hubUrl` | Your Vercel URL |
| `syncRosterFromHub` | `true` — roster from website (recommended) |
| `league` / `gameType` | Labels on saved matches (`SCRIM`, `OFFICIAL`, …) |
| `platformId` | Region of the game (`EUW1`, `EUN1`, …) |
| `pushOnComplete` | `true` — send each game to Vercel when done |
| `captureChampSelectDraft` | `true` — record full pick/ban order if watcher started before draft |

You only need `teamSummoners` / `roster` in the config if `syncRosterFromHub` is `false` or as an offline fallback.

### Ingest API key (local)

Set the same secret as on Vercel before running the watcher:

```powershell
$env:INGEST_API_KEY="your-production-key"
```

Or add to `.env` in the project root (do not commit `.env`):

```
INGEST_API_KEY=your-production-key
```

---

## 4. Capture a scrim (typical workflow)

1. **Add/update players** on the website if the roster changed.
2. Open **League of Legends** and log in.
3. In a terminal in the project folder:

   ```powershell
   npm run lcu:watch
   ```

4. Confirm startup output:

   ```
   Renim A. LCU spectate collector
     Hub: https://lol-app-blush.vercel.app
     Roster: 5 summoners configured
   [roster] Loaded 5 summoner(s) from hub ...
   ```

   Start the watcher **before champion select** if you want the full 20-turn draft log.

5. **Spectate** the game in the LoL client.
6. When the game ends, stay on the **post-game / stats** screen briefly.
7. Watch for success lines:

   ```
   [saved] data/exports/lcu-7123456789.json
   [hub] {"ok":true,...}
   ```

8. **Refresh the website** — the match appears on Overview and Matches.

---

## 5. Useful commands

```powershell
# Health check (LCU + live client)
npm run lcu:status

# Watch mode (main workflow)
npm run lcu:watch

# Manual export if auto-capture missed EOG
npm run lcu:export -- --push

# Re-import saved JSON files from data/exports/
npm run ingest:exports

# Pull hub roster into local tracking files (optional)
npm run sync:lcu-roster
```

---

## 6. Verify connectivity

**Roster from hub** (no API key):

```powershell
curl https://lol-app-blush.vercel.app/api/players/lcu-roster
```

Should return `teamSummoners` and `roster` with your players.

**Ingest status**:

```powershell
curl https://lol-app-blush.vercel.app/api/ingest
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `[roster] Hub has no players with summoner names` | Add players with Riot IDs on the website |
| `[hub] failed: HTTP 401` | `INGEST_API_KEY` on your PC does not match Vercel |
| `[hub] failed: HTTP 503` | Set `INGEST_API_KEY` on Vercel and redeploy |
| `[lcu] Lockfile not found` | Launch League from Riot Client; or set `LCU_LOCKFILE` / `LEAGUE_INSTALL_DIR` |
| `[lcu] Connected but not League Client` | Open LoL (Play), not only Riot Client |
| No EOG / timeout | Stay on post-game screen; run `npm run lcu:export -- --push` |
| Wrong WIN/LOSS or missing players | Riot IDs on the website must match in-game names |
| Live client never up | Spectator game window must be running (port 2999) |
| Empty site after deploy | Run DB seed / add players — see [GITHUB.md](./GITHUB.md) |

Local backups are always saved under `data/exports/` even if the hub push fails. Re-push later with:

```powershell
$env:HUB_URL="https://lol-app-blush.vercel.app"
$env:INGEST_API_KEY="your-production-key"
npm run ingest -- data\exports\lcu-7123456789.json
```

---

## 8. Data flow (summary)

```
Website (Players)  →  Turso DB  →  GET /api/players/lcu-roster  →  LCU watcher
                                                                        ↓
                                                              spectate + capture game
                                                                        ↓
Website (Matches)  ←  Turso DB  ←  POST /api/ingest  ←  finished match JSON
```

---

## More reference

- [LCU-SPECTATE.md](./LCU-SPECTATE.md) — collector internals, config fields, draft capture
- [INGEST.md](./INGEST.md) — ingest API and JSON payload shape
- [GITHUB.md](./GITHUB.md) — deploy, Turso, Vercel env vars
- [COLLECTOR-DATA.md](./COLLECTOR-DATA.md) — field mapping (KDA, items, runes, …)
