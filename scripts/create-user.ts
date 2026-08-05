/**
 * Create or update a team login account (username + password).
 *
 * Usage:
 *   npx tsx scripts/create-user.ts --username coach --name "Coach" --password "secret" --role COACH
 *
 * Roles: PLAYER | SUB | COACH | MANAGER | ANALYTICS
 */
import { createPrismaClient } from "../src/lib/create-prisma-client";
import { hashPassword } from "../src/lib/auth/password";
import { normalizeUsername } from "../src/lib/auth/token";
import type { UserRole } from "@prisma/client";

const ROLES: UserRole[] = [
  "PLAYER",
  "SUB",
  "COACH",
  "MANAGER",
  "ANALYTICS",
];

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const usernameRaw = arg("--username");
  const name = arg("--name");
  const password = arg("--password");
  const roleRaw = (arg("--role") ?? "PLAYER").toUpperCase();

  if (!usernameRaw || !name || !password) {
    console.error(
      'Missing args. Example:\n  npx tsx scripts/create-user.ts --username coach --name "Coach" --password "secret" --role COACH',
    );
    process.exit(1);
  }

  const username = normalizeUsername(usernameRaw);
  if (!username) {
    console.error(
      "Invalid username. Use 2–32 chars: letters, numbers, . _ - (must start with a letter/number).",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  if (!ROLES.includes(roleRaw as UserRole)) {
    console.error(`Invalid role. Use one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const prisma = createPrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          role: roleRaw as UserRole,
          active: true,
        },
      });
      console.log("Updated user:", {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
      });
    } else {
      const created = await prisma.user.create({
        data: {
          username,
          name,
          passwordHash,
          role: roleRaw as UserRole,
          active: true,
        },
      });
      console.log("Created user:", {
        id: created.id,
        username: created.username,
        name: created.name,
        role: created.role,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
