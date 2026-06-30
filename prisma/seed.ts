import { createPrismaClient } from "../src/lib/create-prisma-client";
import { teamRosterEntries } from "../src/lib/team-roster";

const prisma = createPrismaClient();

async function main() {
  await prisma.pickBan.deleteMany();
  await prisma.matchParticipant.deleteMany();
  await prisma.match.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.event.deleteMany();
  await prisma.tierlist.deleteMany();
  await prisma.draftSession.deleteMany();
  await prisma.player.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { name: "Coach Alex", role: "COACH", email: "coach@team.local" },
      { name: "Manager Sam", role: "MANAGER", email: "manager@team.local" },
    ],
  });

  const roster = teamRosterEntries();
  if (roster.length === 0) {
    throw new Error("data/team-roster.json has no players");
  }

  const players = await Promise.all(
    roster.map((p) =>
      prisma.player.create({
        data: {
          displayName: p.displayName,
          summonerName: p.summonerName ?? null,
          teamRole: p.teamRole ?? "FILL",
          memberRole: p.memberRole ?? "PLAYER",
          externalId: p.externalId ?? null,
        },
      }),
    ),
  );

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);

  const availabilityTemplate = JSON.stringify({
    monday: "18:00–22:00",
    tuesday: "19:00–23:00",
    wednesday: "18:00–22:00",
    thursday: "19:00–23:00",
    friday: "17:00–24:00",
    saturday: "14:00–24:00",
    sunday: "14:00–22:00",
  });

  for (const player of players.filter((p) => p.memberRole === "PLAYER")) {
    await prisma.availabilitySlot.create({
      data: {
        playerId: player.id,
        weekStart,
        slots: availabilityTemplate,
      },
    });
  }

  console.log("Seed complete:", { players: players.length });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
