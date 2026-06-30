/** Read env at runtime (avoids Next.js inlining missing build-time values as undefined). */
function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Resolve Turso connection from Vercel / local env (supports common misconfigurations). */
export function resolveTursoConfig():
  | { url: string; authToken: string }
  | null {
  const authToken = env("TURSO_AUTH_TOKEN");
  if (!authToken) return null;

  const tursoUrl = env("TURSO_DATABASE_URL");
  if (tursoUrl) return { url: tursoUrl, authToken };

  const databaseUrl = env("DATABASE_URL");
  if (databaseUrl?.startsWith("libsql:")) {
    return { url: databaseUrl, authToken };
  }

  return null;
}

export function describeDatabaseConfig(): {
  vercel: boolean;
  hasTursoUrl: boolean;
  hasTursoToken: boolean;
  databaseUrlKind: "file" | "libsql" | "other" | "unset";
  mode: "turso" | "local-file" | "missing-on-vercel";
} {
  const turso = resolveTursoConfig();
  const databaseUrl = env("DATABASE_URL");

  let databaseUrlKind: "file" | "libsql" | "other" | "unset" = "unset";
  if (databaseUrl?.startsWith("file:")) databaseUrlKind = "file";
  else if (databaseUrl?.startsWith("libsql:")) databaseUrlKind = "libsql";
  else if (databaseUrl) databaseUrlKind = "other";

  const vercel = env("VERCEL") === "1";

  let mode: "turso" | "local-file" | "missing-on-vercel";
  if (turso) mode = "turso";
  else if (vercel) mode = "missing-on-vercel";
  else mode = "local-file";

  return {
    vercel,
    hasTursoUrl: Boolean(env("TURSO_DATABASE_URL") || databaseUrl?.startsWith("libsql:")),
    hasTursoToken: Boolean(env("TURSO_AUTH_TOKEN")),
    databaseUrlKind,
    mode,
  };
}
