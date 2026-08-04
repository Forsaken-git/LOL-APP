-- Shared team notes (rich text + embedded images).
-- Run once in Turso SQL console (or local SQLite) if prisma db push is not used.

CREATE TABLE IF NOT EXISTS "TeamNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TeamNote_updatedAt_idx" ON "TeamNote"("updatedAt");
