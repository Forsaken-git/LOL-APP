/**
 * Prisma SQLite requires DATABASE_URL to use the file: protocol.
 * On Railway, default to the persistent volume at /data.
 */
const RAILWAY_DB = "file:/data/renim.db";
const LOCAL_DB = "file:./prisma/dev.db";

function onRailway() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ??
      process.env.RAILWAY_PROJECT_ID ??
      process.env.RAILWAY_SERVICE_ID,
  );
}

const current = process.env.DATABASE_URL?.trim() ?? "";
const railway = onRailway();

if (!current) {
  process.env.DATABASE_URL = railway ? RAILWAY_DB : LOCAL_DB;
} else if (railway && !current.startsWith("file:")) {
  // Turso/libsql URLs from an old Vercel setup do not work with Prisma CLI on Railway.
  console.warn(
    `DATABASE_URL="${current}" is not valid for SQLite on Railway — using ${RAILWAY_DB}`,
  );
  process.env.DATABASE_URL = RAILWAY_DB;
} else if (railway && current.startsWith("file:") && !current.includes("/data/")) {
  // file:./dev.db lives inside the container — wiped on every redeploy.
  console.warn(
    `DATABASE_URL="${current}" is not on the Railway volume — using ${RAILWAY_DB}`,
  );
  process.env.DATABASE_URL = RAILWAY_DB;
} else if (!railway && current.startsWith("libsql:")) {
  console.warn(
    `DATABASE_URL uses libsql:// — use ${LOCAL_DB} locally or deploy on Railway with a /data volume`,
  );
  process.env.DATABASE_URL = LOCAL_DB;
}
