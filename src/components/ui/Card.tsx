import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
