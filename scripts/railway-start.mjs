import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import "./ensure-database-url.mjs";

const dbUrl = process.env.DATABASE_URL ?? "";
console.log(`Using DATABASE_URL=${dbUrl}`);

if (process.env.RAILWAY_ENVIRONMENT && dbUrl.includes("/data/")) {
  if (!existsSync("/data")) {
    console.error(
      "ERROR: /data volume is not mounted. Add a Railway volume at mount path /data or data will be lost on redeploy.",
    );
    process.exit(1);
  }
  try {
    mkdirSync("/data", { recursive: true });
  } catch {
    // already exists
  }
}

let result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate"],
  { stdio: "inherit", env: process.env, shell: true },
);
if (result.status !== 0) process.exit(result.status ?? 1);

result = spawnSync("npm", ["run", "start:app"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});
process.exit(result.status ?? 0);
