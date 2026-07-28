import { readFileSync, existsSync } from "fs";
import { createClient } from "@libsql/client";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(".env");
loadEnv(".env.local");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error(
    "No TURSO_DATABASE_URL — apply prisma/turso-soloq-advanced.sql manually.",
  );
  process.exit(2);
}

const sql = readFileSync("prisma/turso-soloq-advanced.sql", "utf8");
const statements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const client = createClient({ url, authToken });
for (const statement of statements) {
  try {
    await client.execute(statement);
    console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate column|already exists/i.test(msg)) {
      console.log("SKIP:", msg);
      continue;
    }
    console.error("FAIL:", msg);
    console.error(statement.slice(0, 120));
    process.exit(1);
  }
}
console.log("Turso SoloQ advanced schema patch applied.");
