# Deploy on Railway (SQLite + persistent volume)

Recommended hosting for this app: **one SQLite file on a Railway volume**, no Turso adapter, no manual SQL export.

---

## What you need

- GitHub repo pushed (e.g. `Forsaken-git/LOL-APP`)
- [Railway](https://railway.com) account (sign in with GitHub)
- `data/team-roster.json` on your PC (for seeding — not in Git)

---

## Step 1 — Create the project

1. Go to [railway.com/new](https://railway.com/new).
2. **Deploy from GitHub repo** → select `LOL-APP`.
3. Railway detects Next.js and uses `railway.toml` in the repo.

---

## Step 2 — Add a persistent volume

SQLite needs disk that survives redeploys.

1. In your Railway project, open the **service** (your app).
2. Go to **Volumes** → **Add Volume**.
3. Set mount path: `/data`
4. Attach the volume to your app service.

---

## Step 3 — Environment variables (required)

In the service → **Variables** tab → **New variable**:

| Name | Value |
|------|--------|
| `DATABASE_URL` | `file:/data/renim.db` |
| `INGEST_API_KEY` | Long random secret (see below) |

Click **Add** for each, then **Deploy** (or redeploy) so the running container picks them up.

**Remove any old Turso URL** (`libsql://...`) from `DATABASE_URL` — that was for Vercel, not Railway. Prisma on Railway only accepts `file:` URLs.

If the app crashes with `Environment variable not found: DATABASE_URL`, this step was skipped or the deploy happened before variables were saved.

`NODE_ENV=production` is usually set by Railway automatically.

Generate a key (PowerShell):

```powershell
-join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) }))
```

---

## Step 4 — Deploy

1. Railway deploys automatically when you push to `main`.
2. On each start, the app runs `prisma db push` then `next start` (see `railway.toml`).
3. **Generate a public domain** (required — do not use an IP address):
   - Service → **Settings** → **Networking** → **Generate Domain**
   - Open `https://your-app-xxxx.up.railway.app` in your browser
   - Raw IPs shown in Railway are internal and will not load the site

---

## Step 5 — Load roster data (one time)

`data/team-roster.json` is **not in Git** (privacy). Railway starts with an empty database.

**From your PC**, push your local roster to the live hub:

```powershell
cd "C:\Users\libor\Desktop\LOL APP"
$env:HUB_URL="https://lol-app-production.up.railway.app"
$env:INGEST_API_KEY="same-key-as-railway-variables"
npm run seed:remote
```

Refresh the site — **Players** should list your roster.

### Push all stats (matches, picks/bans, etc.)

From your PC, with `.env` containing `HUB_URL` and `INGEST_API_KEY`:

```powershell
npm run sync:remote -- --dry-run   # preview counts
npm run sync:remote                # push roster + data/exports (LCU JSON + JSONL)
```

This fills **Overview**, **Matches**, and **Picks & Bans**. Re-run anytime after new games are saved to `data/exports/`.

Single file: `npm run ingest -- data\exports\lcu-123.json`

---

## Step 6 — Push match data to the live hub

Point ingest at your Railway URL:

```powershell
$env:HUB_URL="https://your-app.up.railway.app"
$env:INGEST_API_KEY="same-as-railway"
npm run ingest -- data\import\some-match.json
```

LCU collector: set `hub_url` and `api_key` in `data/lcu-spectate.config.json` to the same values.

---

## Local development (unchanged)

```powershell
copy .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Local `DATABASE_URL` stays `file:./prisma/dev.db`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App starts but DB empty | Run `railway run npm run db:seed` |
| Data lost after redeploy | Volume not mounted at `/data`, or `DATABASE_URL` not pointing to `file:/data/...` |
| Ingest 401 | `INGEST_API_KEY` must match on Railway and your PC |
| Build fails on TypeScript | Fix locally with `npm run build`, push to GitHub |
| `prisma db push` fails on start | Check volume is attached; `DATABASE_URL` must be `file:/data/renim.db` |

---

## Cost

Railway free trial credits, then usage-based billing. A small team hub with one volume is typically a few dollars per month. Check [railway.com/pricing](https://railway.com/pricing).

---

## Vercel alternative

If you prefer Vercel, see [GITHUB.md](./GITHUB.md) — but SQLite on Vercel requires Turso and extra setup. Railway is simpler for this project.
