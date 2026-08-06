import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { canEditPlayerSchedule } from "@/lib/auth/schedule-access";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");

  const slots = await prisma.availabilitySlot.findMany({
    where: weekStart ? { weekStart: new Date(weekStart) } : undefined,
    include: { player: true },
    orderBy: { player: { displayName: "asc" } },
  });

  return NextResponse.json(slots);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { playerId, weekStart, slots } = body;

  if (!playerId || !weekStart || !slots) {
    return NextResponse.json(
      { error: "playerId, weekStart, and slots are required" },
      { status: 400 },
    );
  }

  const allowed = await canEditPlayerSchedule(session, playerId);
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only edit your own schedule" },
      { status: 403 },
    );
  }

  const record = await prisma.availabilitySlot.upsert({
    where: {
      playerId_weekStart: {
        playerId,
        weekStart: new Date(weekStart),
      },
    },
    create: {
      playerId,
      weekStart: new Date(weekStart),
      slots: typeof slots === "string" ? slots : JSON.stringify(slots),
    },
    update: {
      slots: typeof slots === "string" ? slots : JSON.stringify(slots),
    },
  });

  return NextResponse.json(record);
}
