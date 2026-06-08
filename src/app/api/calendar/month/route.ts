import { endOfMonth, startOfMonth } from "date-fns";
import { NextResponse } from "next/server";
import {
  buildMonthMarkers,
  legendForMonth,
  type CalendarEvent,
  type DayMarker,
} from "@/lib/calendar-markers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "year and month query params required" },
      { status: 400 },
    );
  }

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const rows = await prisma.event.findMany({
    where: { startAt: { gte: monthStart, lte: monthEnd } },
    orderBy: { startAt: "asc" },
    select: { id: true, title: true, type: true, startAt: true },
  });
  const playedMatches = await prisma.match.findMany({
    where: {
      status: "PLAYED",
      playedAt: { gte: monthStart, lte: monthEnd },
    },
    select: { playedAt: true },
  });

  const events: CalendarEvent[] = rows.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startAt: e.startAt.toISOString(),
  }));

  const markerMap = buildMonthMarkers(events);
  for (const match of playedMatches) {
    const date = match.playedAt.toISOString().slice(0, 10);
    const existing = markerMap.get(date);
    if (existing) {
      if (!existing.kinds.includes("played")) existing.kinds.push("played");
      continue;
    }
    markerMap.set(date, { date, kinds: ["played"] });
  }
  const days: DayMarker[] = Array.from(markerMap.values());
  const legend = legendForMonth(markerMap);

  return NextResponse.json({ days, legend, events, year, month });
}
