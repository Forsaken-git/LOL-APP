import Link from "next/link";
import { format } from "date-fns";
import { championImageUrl } from "@/lib/champions";
import { parseTierlistRows, tierRowStyle } from "@/lib/tierlist";

export function TierlistCard({
  id,
  name,
  rowsJson,
  updatedAt,
  playerName,
}: {
  id: string;
  name: string;
  rowsJson: string;
  updatedAt: Date;
  playerName?: string | null;
}) {
  const data = parseTierlistRows(rowsJson);
  const tierCounts = data.tiers.map((t, i) => ({
    id: t.id,
    label: t.label,
    count: data.rows[t.id]?.length ?? 0,
    dot: tierRowStyle(i).dot,
  }));
  const total = tierCounts.reduce((n, t) => n + t.count, 0);
  const preview = data.tiers.flatMap((t) => data.rows[t.id] ?? []).slice(0, 10);

  return (
    <Link
      href={`/tierlists/${id}`}
      className="group block rounded-xl border border-border bg-surface/60 px-4 py-3 transition-all hover:border-accent/30 hover:bg-surface/90"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground group-hover:text-accent-bright">
            {name}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {playerName ? (
              <>
                <span className="text-foreground/80">{playerName}</span>
                <span className="mx-1">·</span>
              </>
            ) : null}
            {total} champions · {format(updatedAt, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {tierCounts.map(({ id: tierId, label, count, dot }) =>
            count > 0 ? (
              <span
                key={tierId}
                className="flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted"
                title={`${label}: ${count}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {label}
                <span className="opacity-60">{count}</span>
              </span>
            ) : null,
          )}
        </div>
      </div>

      {preview.length > 0 && (
        <div className="mt-3 flex items-center">
          {preview.map((champion, i) => (
            <img
              key={champion}
              src={championImageUrl(champion)}
              alt={champion}
              title={champion}
              className="h-7 w-7 rounded-md border border-white/10 object-cover"
              style={{ marginLeft: i === 0 ? 0 : -6, zIndex: preview.length - i }}
            />
          ))}
          {total > preview.length && (
            <span className="ml-2 text-[10px] text-muted">+{total - preview.length}</span>
          )}
        </div>
      )}
    </Link>
  );
}
