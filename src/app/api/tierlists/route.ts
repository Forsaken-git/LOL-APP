import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tierlists = await prisma.tierlist.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(tierlists);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, category, rows } = body;

  if (!name || !rows) {
    return NextResponse.json(
      { error: "name and rows are required" },
      { status: 400 },
    );
  }

  const tierlist = await prisma.tierlist.create({
    data: {
      name,
      category: category ?? "champions",
      rows: typeof rows === "string" ? rows : JSON.stringify(rows),
    },
  });

  return NextResponse.json(tierlist, { status: 201 });
}
