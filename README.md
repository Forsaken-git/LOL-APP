# Renim A. — Team Hub

A shareable web app for your League of Legends team: calendar, match stats, picks/bans, player pools, weekly availability, draft practice, and tierlists.

## Features

- **Overview** — Win/loss, win rate, red/blue side stats, last MVP, recent matches
- **Calendar** — Month view + create matches, training, scrims, meetings
- **Matches** — Full history with league filter
- **Picks & Bans** — Most picked/banned champions
- **Players** — Roster with champion pools (official vs training)
- **Schedule** — Weekly availability per player + team overlap overview
- **Drafts** — Plan upcoming games with guided pick/ban order; data feeds Picks & Bans stats
- **Tierlists** — Create and edit S–D tierlists

**LCU spectate collector** — capture games while spectating (no Riot API key). Riot Match-V5 auto-import is still planned.

## Collector script / external data

The app is built to **react to data your script pushes** — not only manual seed data.

1. Your script outputs JSON (see `data/example-export.json`).
2. POST it to `/api/ingest` (use stable `externalId` on matches/players for upserts).
3. Refresh the hub — overview, matches, picks/bans, and players update automatically.

```bash
# Local test push
npm run ingest -- data/example-export.json

# Import team JSON folders (cwl, scrims, titans league, officials)
npm run ingest:teams

# Import all saved LCU JSONs from data/exports/ (no dev server)
npm run ingest:exports

# Or Python
python scripts/push_ingest.py data/example-export.json
```

Full API reference: **[docs/INGEST.md](docs/INGEST.md)**.

### LCU spectate collector (auto-capture while watching)

While you spectate in the **League client**, a local Python tool reads LCU + Live Client Data and pushes finished games to the hub.

```bash
copy data\lcu-spectate.config.example.json data\lcu-spectate.config.json
# edit roster + teamSummoners

npm run dev          # hub
npm run lcu:watch    # collector (separate terminal)
```

Guide: **[docs/LCU-SPECTATE.md](docs/LCU-SPECTATE.md)**.

## Quick start (local)

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` → `.env` if you have not already. Data lives in `prisma/dev.db`.

Re-import saved LCU games anytime:

```bash
npm run pull:local
# or
npm run ingest:exports
```

### Customizing seed data

Edit `prisma/seed.ts` with your real player names, leagues, and matches, then run:

```bash
npm run db:seed
```

## Tech stack

- Next.js 16 (App Router)
- Prisma + SQLite (local)
- Tailwind CSS 4

## Project structure

```
src/app/          Pages (dashboard, calendar, matches, …)
src/components/   UI and interactive tools
src/lib/          Prisma client, stats helpers, champion list
prisma/           Schema and seed data
```

## Roadmap

- [ ] Login + roles (player, sub, coach, manager, analytics)
- [x] LCU spectate collector — auto-capture while spectating
- [ ] Riot API — auto-import matches and summoner stats
- [ ] Match entry form (add games without editing seed)
- [ ] Discord notifications for calendar events
