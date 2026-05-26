import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const drafts = await prisma.draftSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(drafts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, bluePicks, blueBans, redPicks, redBans, notes } = body;

  const draft = await prisma.draftSession.create({
    data: {
      name: name ?? "Practice Draft",
      bluePicks: JSON.stringify(bluePicks ?? []),
      blueBans: JSON.stringify(blueBans ?? []),
      redPicks: JSON.stringify(redPicks ?? []),
      redBans: JSON.stringify(redBans ?? []),
      notes: notes ?? null,
    },
  });

  return NextResponse.json(draft, { status: 201 });
}
