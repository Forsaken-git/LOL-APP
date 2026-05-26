import { NextResponse } from "next/server";
import { verifyIngestAuth } from "@/lib/ingest/auth";
import { runIngest } from "@/lib/ingest/sync";
import type { IngestMatch } from "@/lib/ingest/types";

/** Upsert a single match by externalId (e.g. Riot match id). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  const authError = verifyIngestAuth(request);
  if (authError) return authError;

  const { externalId } = await params;
  let body: Omit<IngestMatch, "externalId">;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await runIngest({
    source: body.source ?? "match-upsert",
    matches: [{ ...body, externalId }],
  });

  return NextResponse.json(result, { status: result.success ? 200 : 207 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  const authError = verifyIngestAuth(_request);
  if (authError) return authError;

  const { externalId } = await params;
  const { prisma } = await import("@/lib/prisma");

  const match = await prisma.match.findUnique({ where: { externalId } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  await prisma.match.delete({ where: { id: match.id } });
  return NextResponse.json({ ok: true, externalId });
}
