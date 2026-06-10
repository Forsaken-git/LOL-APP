"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileMenuButton } from "./MobileMenuButton";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isDrafter = pathname.startsWith("/drafter");

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

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 mesh-bg opacity-40"
          aria-hidden
        />
        <main className="relative flex-1 overflow-auto lg:pb-0">
          <div
            className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 ${
              isDrafter ? "max-w-[1700px]" : "max-w-7xl"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
      <MobileMenuButton onOpen={() => setMobileMenuOpen(true)} />
    </div>
  );
}
