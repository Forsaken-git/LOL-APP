import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function SyncStatus() {
  const lastRun = await prisma.ingestRun.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!lastRun) {
    return (
      <p className="max-w-md rounded-xl border border-border bg-inset/80 px-4 py-2.5 text-xs text-muted">
        No script sync yet — POST your collector output to{" "}
        <code className="font-mono text-accent-bright">/api/ingest</code> (see
        docs/INGEST.md)
      </p>
    );
  }

  let summary: { matches?: { created: number; updated: number } } = {};
  try {
    summary = JSON.parse(lastRun.summary);
  } catch {
    /* ignore */
  }

  return (
    <p
      className={`max-w-md rounded-xl border px-4 py-2.5 text-xs ${
        lastRun.success
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-200"
      }`}
    >
      Last sync {formatDistanceToNow(lastRun.createdAt, { addSuffix: true })}
      {lastRun.source ? ` · ${lastRun.source}` : ""}
      {summary.matches != null &&
        ` · matches +${summary.matches.created} / ~${summary.matches.updated}`}
      {!lastRun.success && " · some rows failed (check ingest log)"}
    </p>
  );
}
