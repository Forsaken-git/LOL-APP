import { NextResponse } from "next/server";
import { parseEventBody } from "@/lib/events/parse-body";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.event.findMany({ orderBy: { startAt: "asc" } });
  return NextResponse.json(events);
}

export async function POST(request: Request) {
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
    const event = await prisma.event.create({ data: parsed.data });
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    console.error("POST /api/events", e);
    return NextResponse.json(
      { error: "Failed to create event. Try restarting the dev server." },
      { status: 500 },
    );
  }
}
