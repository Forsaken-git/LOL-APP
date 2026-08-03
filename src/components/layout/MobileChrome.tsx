"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bird, Menu } from "lucide-react";
import {
  isNavActive,
  MOBILE_PRIMARY_NAV,
} from "./nav-items";

export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="mobile-top-bar sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b border-border bg-surface/95 backdrop-blur-xl lg:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        className="mobile-menu-hit flex shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-surface-elevated text-foreground transition-transform active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="mobile-menu-icon" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Team Hub
        </p>
        <p className="truncate font-serif text-lg font-semibold uppercase leading-tight tracking-wide text-foreground sm:text-xl">
          Renim A.
        </p>
      </div>
      <div
        className="mobile-menu-hit flex shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-gradient-to-br from-accent-bright to-accent-dim shadow-md shadow-accent/20"
        aria-hidden
      >
        <Bird className="mobile-menu-icon text-background" strokeWidth={1.75} />
      </div>
    </header>
  );
}

export function MobileBottomNav({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
      aria-label="Primary"
    >
      <div className="mobile-bottom-nav-inner mx-auto flex max-w-lg items-stretch justify-between gap-1">
        {MOBILE_PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`mobile-bottom-item flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors ${
                active
                  ? "text-accent-bright"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon
                className={`mobile-bottom-icon shrink-0 ${
                  active ? "text-accent-bright" : ""
                }`}
              />
              <span className="mobile-bottom-label truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="mobile-bottom-item flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-muted transition-colors hover:text-foreground"
          aria-label="Open full menu"
        >
          <Menu className="mobile-bottom-icon shrink-0" />
          <span className="mobile-bottom-label truncate">Menu</span>
        </button>
      </div>
    </nav>
  );
}
