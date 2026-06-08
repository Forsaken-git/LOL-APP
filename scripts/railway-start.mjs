import { spawnSync } from "node:child_process";
import "./ensure-database-url.mjs";

console.log(`Using DATABASE_URL=${process.env.DATABASE_URL}`);

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
