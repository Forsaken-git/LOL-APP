import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {children}
    </header>
  );
}
