/**
 * Prisma requires DATABASE_URL to exist when loading schema.prisma.
 * Railway users often forget to set it — default to the /data volume path.
 */
if (!process.env.DATABASE_URL?.trim()) {
  const onRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT ??
      process.env.RAILWAY_PROJECT_ID ??
      process.env.RAILWAY_SERVICE_ID,
  );
  process.env.DATABASE_URL = onRailway
    ? "file:/data/renim.db"
    : "file:./prisma/dev.db";
}
