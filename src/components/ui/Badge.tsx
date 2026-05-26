export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "win" | "loss" | "blue" | "red" | "default";
}) {
  const styles = {
    win: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    loss: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    red: "bg-rose-600/15 text-rose-300 border-rose-600/30",
    default: "bg-accent/10 text-accent-bright border-accent/25",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
