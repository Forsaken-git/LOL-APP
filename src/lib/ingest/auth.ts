import { NextResponse } from "next/server";

export function verifyIngestAuth(request: Request): NextResponse | null {
  const expected = process.env.INGEST_API_KEY;

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "INGEST_API_KEY is not configured on the server" },
        { status: 503 },
      );
    }
    return null;
  }

  const headerKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!headerKey || headerKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
