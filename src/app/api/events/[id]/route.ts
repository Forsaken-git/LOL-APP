import { NextResponse } from "next/server";
import { parseEventBody } from "@/lib/events/parse-body";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseEventBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const event = await prisma.event.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.event.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
