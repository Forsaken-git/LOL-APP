"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth/token";

export function AuthUserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { user: SessionUser };
      if (!cancelled) setUser(body.user);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }

  if (!user) return null;

  return (
    <div
      className={`border-t border-border ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}
    >
      {!collapsed ? (
        <div className="mb-2 px-1">
          <p className="truncate text-sm font-medium text-foreground">
            @{user.username}
          </p>
          <p className="truncate text-[11px] text-faint">{user.name}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void logout()}
        disabled={pending}
        className={`btn-ghost inline-flex w-full items-center gap-2 text-sm ${
          collapsed ? "justify-center px-2" : ""
        }`}
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        {!collapsed ? (pending ? "Signing out…" : "Sign out") : null}
      </button>
    </div>
  );
}
