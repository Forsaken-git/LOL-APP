export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "win" | "loss" | "accent";
}) {
  const colors = {
    win: "text-emerald-400",
    loss: "text-rose-400",
    accent: "text-accent-bright",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated/80 p-5 transition-colors hover:border-white/15">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0"
        aria-hidden
      />
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`relative mt-2 text-3xl font-bold tabular-nums tracking-tight ${accent ? colors[accent] : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
