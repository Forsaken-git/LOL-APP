-- Wipe all team data (Turso SQL console or: turso db shell < prisma/wipe-all-data.sql)
-- Run only when you intend to delete everything.

DELETE FROM "PickBan";
DELETE FROM "MatchParticipant";
DELETE FROM "DraftSession";
UPDATE "Match" SET "mvpId" = NULL;
DELETE FROM "Match";
DELETE FROM "DraftPrepScenario";
DELETE FROM "IngestRun";
DELETE FROM "AvailabilitySlot";
DELETE FROM "Tierlist";
DELETE FROM "PlayerAccount";
DELETE FROM "Player";
DELETE FROM "User";
DELETE FROM "Event";
