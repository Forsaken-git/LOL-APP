"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Swords,
  Users,
  Ban,
  Clock,
  Layers,
  ListOrdered,
  Hexagon,
} from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/picks-bans", label: "Picks & Bans", icon: Ban },
  { href: "/players", label: "Players", icon: Users },
  { href: "/availability", label: "Schedule", icon: Clock },
  { href: "/drafter", label: "Drafter", icon: Layers },
  { href: "/tierlists", label: "Tierlists", icon: ListOrdered },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[17rem] shrink-0 flex-col border-r border-border bg-surface/80 backdrop-blur-xl">
      <div className="border-b border-border px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-bright to-accent-dim shadow-lg shadow-accent/25">
            <Hexagon className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Team Hub
            </p>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Renim A.
            </h1>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-accent/15 text-foreground"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground"
              }`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-bright"
                  aria-hidden
                />
              )}
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-accent-bright"
                    : "text-faint group-hover:text-muted"
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="rounded-lg bg-inset/80 px-3 py-2 text-[10px] leading-relaxed text-faint">
          Data syncs via{" "}
          <code className="font-mono text-[10px] text-accent-bright">/api/ingest</code>
        </p>
      </div>
    </aside>
  );
}
