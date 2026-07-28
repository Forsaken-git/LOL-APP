-- SoloQ advanced metrics schema patch for Turso / SQLite.
-- Apply once against production Turso:
--   turso db shell YOUR_DB_NAME < prisma/turso-soloq-advanced.sql
--
-- Safe to re-run: uses IF NOT EXISTS where possible.
-- ALTER TABLE ADD COLUMN will error if puuid already exists — ignore that error.

ALTER TABLE "PlayerAccount" ADD COLUMN "puuid" TEXT;

CREATE INDEX IF NOT EXISTS "PlayerAccount_puuid_idx" ON "PlayerAccount"("puuid");

CREATE TABLE IF NOT EXISTS "SoloQRankSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tier" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "lp" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    CONSTRAINT "SoloQRankSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlayerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SoloQRankSnapshot_accountId_capturedAt_idx"
  ON "SoloQRankSnapshot"("accountId", "capturedAt");

CREATE TABLE IF NOT EXISTS "SoloQMatchSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL,
    "queueId" INTEGER NOT NULL,
    "gameVersion" TEXT NOT NULL,
    "champion" TEXT NOT NULL,
    "win" BOOLEAN NOT NULL,
    "cs" INTEGER NOT NULL,
    "gold" INTEGER NOT NULL,
    "damage" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "teamDamage" INTEGER,
    "role" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoloQMatchSummary_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlayerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SoloQMatchSummary_accountId_matchId_key"
  ON "SoloQMatchSummary"("accountId", "matchId");

CREATE INDEX IF NOT EXISTS "SoloQMatchSummary_accountId_playedAt_idx"
  ON "SoloQMatchSummary"("accountId", "playedAt");

CREATE INDEX IF NOT EXISTS "SoloQMatchSummary_queueId_idx"
  ON "SoloQMatchSummary"("queueId");
