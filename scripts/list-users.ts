/**
 * List team login accounts (no passwords).
 *
 *   npx tsx scripts/list-users.ts
 */
import { createPrismaClient } from "../src/lib/create-prisma-client";

async function main() {
  const prisma = createPrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: [{ active: "desc" }, { username: "asc" }],
    });

    if (users.length === 0) {
      console.log("No users yet. Create one with scripts/create-user.ts");
      return;
    }

    console.log(`Accounts (${users.length}):\n`);
    for (const u of users) {
      console.log(
        `  ${(u.username ?? "(no username)").padEnd(16)}  ${u.name.padEnd(20)}  ${u.role.padEnd(10)}  ${u.active ? "active" : "disabled"}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
