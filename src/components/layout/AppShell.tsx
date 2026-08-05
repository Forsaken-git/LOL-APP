"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileBottomNav, MobileTopBar } from "./MobileChrome";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isDraftPrep = pathname.startsWith("/draft-prep");
  const isLogin = pathname === "/login";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 mesh-bg opacity-25"
          aria-hidden
        />
        <MobileTopBar onOpenMenu={() => setMobileMenuOpen(true)} />
        <main
          className={`relative flex-1 lg:pb-0 ${
            isDraftPrep
              ? "flex min-h-0 flex-col overflow-hidden"
              : "mobile-main-pad overflow-auto"
          }`}
        >
          <div
            className={
              isDraftPrep
                ? "flex h-full min-h-0 flex-1 flex-col"
                : "mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
            }
          >
            {children}
          </div>
        </main>
        {!isDraftPrep && (
          <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
        )}
      </div>
    </div>
  );
}
