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

## Step 2 — Add a persistent volume (required — do not skip)

SQLite stores everything in one file. **Without a volume, that file lives inside the container and is deleted on every redeploy.**

1. In your Railway project, open the **LOL-APP** service.
2. Go to **Volumes** → **Add Volume** (or **+ New Volume**).
3. Set **mount path** to exactly: `/data`
4. **Attach** the volume to the LOL-APP service (not a separate empty service).
5. Redeploy once after attaching.

Your database file will live at `/data/renim.db` on that volume — it survives code deploys and restarts.

**Check it's working:** after deploy, open **Deploy Logs** and confirm:

```text
Using DATABASE_URL=file:/data/renim.db
```

If you see `file:./dev.db` or `file:./prisma/dev.db`, data will **not** persist — fix `DATABASE_URL` in Variables (Step 3).

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

## Keep data across redeploys (detailed walkthrough)

### Simple explanation

Your app saves matches and players in a **database file** (`renim.db`).

On Railway, each deploy starts a **new temporary computer** (container). Anything saved *inside* that container is thrown away when Railway redeploys.

A **Volume** is a hard drive Railway keeps between deploys. You must:

1. Create a volume and mount it at `/data`
2. Tell the app to save the database at `file:/data/renim.db` (on that hard drive)

Then redeploys only update your **code** — the database file stays.

---

### Part A — Create the volume in Railway

1. Open [railway.com](https://railway.com) and sign in.
2. Click your project (e.g. **magnificent-gentleness**).
3. You should see a box/card named **LOL-APP** — click it.  
   (This is your app “service”, not the project name at the top.)
4. Look at the **top tabs** inside that service: Deployments, Variables, Metrics, **Settings**, etc.  
   Railway’s UI changes sometimes; the volume may be under:
   - **Settings** → scroll to **Volumes**, or
   - A **Volumes** tab directly on the service.
5. Click **Add Volume** or **+ New Volume**.
6. When it asks for **Mount Path**, type exactly:

   ```
   /data
   ```

   No `C:\`, no `data` without the slash — exactly `/data`.

7. Make sure the volume is **attached to LOL-APP** (the same service that runs your website).  
   If Railway created a separate empty service for the volume, open LOL-APP → Settings → Volumes → attach the existing volume.
8. Click **Save** / **Create**.

---

### Part B — Set environment variables

Still inside the **LOL-APP** service:

1. Open the **Variables** tab.
2. Find `DATABASE_URL`:
   - If it exists → click **Edit**
   - If not → click **New Variable** / **Add Variable**
3. Set:
   - **Name:** `DATABASE_URL`
   - **Value:** `file:/data/renim.db`
4. Delete or fix any **wrong** values you may have from earlier:
   - `libsql://...` (Turso — wrong for Railway)
   - `file:./dev.db` (inside container — **wiped on redeploy**)
   - `file:./prisma/dev.db` (same problem)
5. Confirm `INGEST_API_KEY` is also set (your secret hex key).
6. Railway usually auto-redeploys when you save variables. If not: **Deployments** → **⋯** on latest → **Redeploy**.

---

### Part C — Check the deploy logs

1. Go to **Deployments** on LOL-APP.
2. Click the latest deployment (should be green / **Active**).
3. Open **View logs** / **Build Logs** → scroll to where the app **starts** (after build).
4. You want to see:

   ```text
   Using DATABASE_URL=file:/data/renim.db
   ```

5. **Good signs:** Next.js starts, no crash, site loads.

6. **Bad signs:**

   | Log message | What to do |
   |-------------|------------|
   | `file:./dev.db` | Fix `DATABASE_URL` to `file:/data/renim.db` |
   | `/data volume is not mounted` | Volume not attached — redo Part A |
   | App crash-loops | Paste logs and fix before syncing data |

---

### Part D — Put your data on the live site (from your PC)

The volume starts **empty**. Copy data from your PC once (and again only if you ever lose the volume).

1. On your PC, open PowerShell.
2. Go to the project folder:

   ```powershell
   cd "C:\Users\libor\Desktop\LOL APP"
   ```

3. Make sure your `.env` file contains (edit in Notepad if needed):

   ```env
   HUB_URL=https://lol-app-production.up.railway.app
   INGEST_API_KEY=your-same-key-as-railway
   DATABASE_URL=file:./prisma/dev.db
   ```

   Use your real Railway URL and API key.  
   Local `DATABASE_URL` is for your PC only — Railway uses `file:/data/renim.db`.

4. Push everything (roster + matches):

   ```powershell
   npm run sync:remote
   ```

5. Wait until it finishes (`Done — refresh the hub`).
6. Open **https://lol-app-production.up.railway.app** → check **Players** and **Matches**.

---

### Part E — Test that data survives a redeploy

1. In Railway → LOL-APP → **Deployments** → **Redeploy** (deploy the same code again).
2. Wait until Active.
3. Refresh your website.

**If setup is correct:** players and matches are still there.  
**If empty again:** volume or `DATABASE_URL` is still wrong — repeat Parts A–C.

---

### Quick reference

| Requirement | Why |
|-------------|-----|
| Volume mounted at `/data` | Only disk that survives redeploys |
| `DATABASE_URL=file:/data/renim.db` | DB file must be **on** the volume |
| Run `npm run sync:remote` after first setup | Fills DB once volume + URL are correct |

**Wrong (data wiped each deploy):** no volume, or `file:./dev.db`  
**Right:** volume at `/data` + `DATABASE_URL=file:/data/renim.db`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App starts but DB empty | Run `npm run sync:remote` from your PC |
| Data lost after redeploy | Add volume at `/data`; set `DATABASE_URL=file:/data/renim.db`; re-run `sync:remote` |
| Log says `/data volume is not mounted` | Attach volume to LOL-APP service in Railway dashboard |
| Ingest 401 | `INGEST_API_KEY` must match on Railway and your PC |
| Build fails on TypeScript | Fix locally with `npm run build`, push to GitHub |
| `prisma db push` fails on start | Check volume is attached; `DATABASE_URL` must be `file:/data/renim.db` |

---

## Cost

Railway free trial credits, then usage-based billing. A small team hub with one volume is typically a few dollars per month. Check [railway.com/pricing](https://railway.com/pricing).

---

## Vercel alternative

If you prefer Vercel, see [GITHUB.md](./GITHUB.md) — but SQLite on Vercel requires Turso and extra setup. Railway is simpler for this project.
