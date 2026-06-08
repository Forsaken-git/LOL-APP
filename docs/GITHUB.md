# Publish on GitHub (and share a live link)

There are two separate steps:

1. **GitHub** — store code (public or private repository).
2. **Vercel** (recommended) — host the app at a URL like `https://renim-a.vercel.app`.

SQLite on your PC does **not** travel to the cloud. A hosted app needs a cloud database (Turso is the smallest change).

---

## Before you push — privacy checklist

These stay **out** of Git (already in `.gitignore`):

| Item | Why |
|------|-----|
| `.env` | Secrets (`INGEST_API_KEY`, DB URL) |
| `prisma/dev.db` | Your real matches and stats |
| `data/team-roster.json` | Real summoner names |
| `data/import/`, `data/exports/` | Match exports |

Safe to commit: `data/team-roster.example.json`, `data/example-export.json`.

Copy your real roster locally after clone:

```bash
copy data\team-roster.example.json data\team-roster.json
# then edit with your roster
```

---

## Step 1 — Create a GitHub repository

1. Sign in at [github.com](https://github.com).
2. **New repository** → name e.g. `renim-a` or `lol-team-hub`.
3. Choose **Public** (anyone sees code) or **Private** (only you/collaborators; the live site can still be shared via URL).
4. Do **not** add a README or `.gitignore` (this project already has them).

### Push from your PC (PowerShell)

```powershell
cd "C:\Users\libor\Desktop\LOL APP"

git add .
git commit -m "Renim A. team hub — initial publish"

git branch -M main
git remote add origin https://github.com/Forsaken-git/Renim.A.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your values. GitHub may ask you to sign in (browser or [Personal Access Token](https://github.com/settings/tokens)).

Optional: install [GitHub CLI](https://cli.github.com/) later for `gh repo create` from the terminal.

---

## Step 2 — Live website with Vercel + Turso

### 2a — Turso database (free tier)

1. Create an account at [turso.tech](https://turso.tech).
2. Create a database (e.g. `renim-a`).
3. Copy the **connection URL** (starts with `libsql://`).

Prisma in this project uses `provider = "sqlite"`, which works with Turso.

### 2b — Deploy on Vercel

1. Sign in at [vercel.com](https://vercel.com) with **GitHub**.
2. **Add New Project** → import your repository.
3. **Environment variables**:

   | Name | Value |
   |------|--------|
   | `DATABASE_URL` | Turso `libsql://...` URL |
   | `INGEST_API_KEY` | Long random secret (e.g. from `openssl rand -hex 32`) |

4. **Build command** (override if needed):

   ```bash
   npx prisma db push && npm run build
   ```

5. Deploy. Open the URL Vercel gives you.

### 2c — Seed production once

From your machine, pointing at the **production** database:

```powershell
$env:DATABASE_URL="libsql://..."   # Turso URL
$env:INGEST_API_KEY="your-production-key"
npx prisma db push
npm run db:seed
```

Copy `data/team-roster.json` content into production by running ingest with your JSON, or edit seed / use `npm run ingest -- file.json --local` against prod `DATABASE_URL`.

### 2d — Ingest from your PC to the live hub

```powershell
$env:HUB_URL="https://your-app.vercel.app"
$env:INGEST_API_KEY="same-as-vercel"
npm run ingest -- data\import\cwl\some-match.json
```

LCU collector: set `hub_url` and `api_key` in `data/lcu-spectate.config.json` to the same values.

---

## Public vs private

| Goal | Setup |
|------|--------|
| Open-source code | GitHub **public** repo |
| Team-only code | GitHub **private** repo |
| Anyone on the internet can open the site | Public repo + Vercel (no login yet — **all pages are public**) |
| Team-only website | Vercel **Deployment Protection** (Pro) or add auth later |

Until login exists, treat the Vercel URL like a shared link: anyone with the URL can read matches and roster data you put in the database.

---

## Troubleshooting

- **Build fails on Prisma** — `DATABASE_URL` must be set in Vercel env vars before build.
- **Ingest 401** — `INGEST_API_KEY` must match on client and Vercel.
- **Ingest 503** — set `INGEST_API_KEY` in production (required when `NODE_ENV=production`).
- **Empty players after deploy** — run `db:seed` and ensure `data/team-roster.json` exists locally; roster file is not in Git.

---

## CI (optional)

This repo includes `.github/workflows/ci.yml` to run `prisma db push` and `next build` on every push.
