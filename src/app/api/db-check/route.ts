import { describeDatabaseConfig } from "@/lib/turso-config";

export const dynamic = "force-dynamic";

/** Debug endpoint — shows whether Turso env vars are visible (no secrets). */
export async function GET() {
  const config = describeDatabaseConfig();

  return Response.json({
    ...config,
    hint:
      config.mode === "turso"
        ? "Turso env vars detected. If pages still fail, run prisma/turso-init.sql in Turso SQL console."
        : config.mode === "missing-on-vercel"
          ? "Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN under Vercel → Settings → Environment Variables → Production, then Redeploy."
          : "Using local SQLite file.",
  });
}
