-- Run on existing Turso DBs (after initial turso-init.sql)
CREATE TABLE IF NOT EXISTS "DraftPrepScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "pickBans" TEXT NOT NULL DEFAULT '[]',
    "extraBanSlots" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DraftPrepScenario_col_row_key" ON "DraftPrepScenario"("col", "row");
