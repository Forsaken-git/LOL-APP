/**
 * Prisma SQLite requires DATABASE_URL to use the file: protocol.
 */
const LOCAL_DB = "file:./prisma/dev.db";

const current = process.env.DATABASE_URL?.trim() ?? "";

if (!current) {
  process.env.DATABASE_URL = LOCAL_DB;
} else if (current.startsWith("libsql:")) {
  console.warn(`DATABASE_URL uses libsql:// — using ${LOCAL_DB}`);
  process.env.DATABASE_URL = LOCAL_DB;
}
