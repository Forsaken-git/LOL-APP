import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { name, rows } = body;

  const tierlist = await prisma.tierlist.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(rows && {
        rows: typeof rows === "string" ? rows : JSON.stringify(rows),
      }),
    },
  });

  return NextResponse.json(tierlist);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.tierlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
