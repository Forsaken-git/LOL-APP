-- Team login accounts (username + passwordHash).
-- Run once in Turso SQL console (skip a line if the column already exists).

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
