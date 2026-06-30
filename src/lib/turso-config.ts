/** Resolve Turso connection from Vercel / local env (supports common misconfigurations). */
export function resolveTursoConfig():
  | { url: string; authToken: string }
  | null {
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!authToken) return null;

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) return { url: tursoUrl, authToken };

  const databaseUrl = process.env.DATABASE_URL?.trim();
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
  const databaseUrl = process.env.DATABASE_URL?.trim();

  let databaseUrlKind: "file" | "libsql" | "other" | "unset" = "unset";
  if (databaseUrl?.startsWith("file:")) databaseUrlKind = "file";
  else if (databaseUrl?.startsWith("libsql:")) databaseUrlKind = "libsql";
  else if (databaseUrl) databaseUrlKind = "other";

  const vercel = Boolean(process.env.VERCEL);

  let mode: "turso" | "local-file" | "missing-on-vercel";
  if (turso) mode = "turso";
  else if (vercel) mode = "missing-on-vercel";
  else mode = "local-file";

  return {
    vercel,
    hasTursoUrl: Boolean(
      process.env.TURSO_DATABASE_URL?.trim() ||
        databaseUrl?.startsWith("libsql:"),
    ),
    hasTursoToken: Boolean(process.env.TURSO_AUTH_TOKEN?.trim()),
    databaseUrlKind,
    mode,
  };
}
