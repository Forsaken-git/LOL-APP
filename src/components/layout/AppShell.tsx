"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const isDrafter = pathname.startsWith("/drafter");

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 mesh-bg opacity-40"
          aria-hidden
        />
        <main className="relative flex-1 overflow-auto">
          <div
            className={`mx-auto px-6 py-10 sm:px-8 lg:px-10 ${
              isDrafter ? "max-w-[1700px]" : "max-w-7xl"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
