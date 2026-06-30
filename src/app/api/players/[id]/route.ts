import { NextResponse } from "next/server";
import { deletePlayer } from "@/lib/players/delete-player";
import { setPlayerActive } from "@/lib/players/set-active";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await deletePlayer(id);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    const status = message === "Player not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("active" in body)) {
    return NextResponse.json({ error: "active boolean is required" }, { status: 400 });
  }

  const { active } = body as { active: unknown };
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
  }

  try {
    const result = await setPlayerActive(id, active);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    const status = message === "Player not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
