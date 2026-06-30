import { NextResponse } from "next/server";
import { createPlayer, parseCreatePlayerBody } from "@/lib/players/create";
import { activeTeamPlayerWhere } from "@/lib/players/team-player";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.player.findMany({
    where: activeTeamPlayerWhere,
    orderBy: [{ memberRole: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      summonerName: true,
      teamRole: true,
      memberRole: true,
      externalId: true,
    },
  });

  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseCreatePlayerBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await createPlayer(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create player";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
