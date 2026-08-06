-- Flat folders for shared team notes.
-- Run once in Turso SQL console (or local SQLite) if prisma db push is not used.

CREATE TABLE IF NOT EXISTS "TeamNoteFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "TeamNote" ADD COLUMN "folderId" TEXT;

CREATE INDEX IF NOT EXISTS "TeamNote_folderId_idx" ON "TeamNote"("folderId");
