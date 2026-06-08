"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  PenLine,
  Swords,
  Users,
  Ban,
  Hexagon,
} from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/picks-bans", label: "Picks & Bans", icon: Ban },
  { href: "/drafter", label: "Drafter", icon: PenLine },
  { href: "/players", label: "Players", icon: Users },
  { href: "/tierlists", label: "Tierlists", icon: ListOrdered },
];

export function Sidebar({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-surface/80 backdrop-blur-xl transition-all ${
        collapsed ? "w-[4.5rem]" : "w-[17rem]"
      }`}
    >
      <div className={`border-b border-border ${collapsed ? "px-0 py-4" : "px-5 py-6"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-bright to-accent-dim shadow-lg shadow-accent/25 transition-transform hover:scale-105"
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          >
            <Hexagon className="h-5 w-5 text-white" strokeWidth={2.25} />
          </button>
          {!collapsed && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Team Hub
              </p>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Renim A.
              </h1>
            </div>
          )}
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
              className={`group relative flex items-center rounded-xl text-sm font-medium transition-all ${
                collapsed
                  ? "justify-center px-2 py-2.5"
                  : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-accent/15 text-foreground"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground"
              }`}
              title={collapsed ? label : undefined}
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
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-border px-4 py-4">
          <p className="rounded-lg bg-inset/80 px-3 py-2 text-[10px] leading-relaxed text-faint">
            Data syncs via{" "}
            <code className="font-mono text-[10px] text-accent-bright">/api/ingest</code>
          </p>
        </div>
      )}
    </aside>
  );
}
