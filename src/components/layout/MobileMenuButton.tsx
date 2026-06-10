"use client";

import { Menu } from "lucide-react";

export function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface/95 text-foreground shadow-lg shadow-black/30 backdrop-blur-xl transition-transform hover:scale-105 active:scale-95 lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
