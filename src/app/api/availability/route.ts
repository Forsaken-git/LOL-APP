import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  const body = await request.json();
  const { playerId, weekStart, slots } = body;

  if (!playerId || !weekStart || !slots) {
    return NextResponse.json(
      { error: "playerId, weekStart, and slots are required" },
      { status: 400 },
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
