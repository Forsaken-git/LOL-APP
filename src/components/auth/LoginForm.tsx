"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bird } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
    if (raw.startsWith("/login")) return "/";
    return raw;
  }, [searchParams]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Login failed");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 mesh-bg opacity-40"
        aria-hidden
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface/95 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-gradient-to-br from-accent-bright to-accent-dim shadow-lg shadow-accent/20">
            <Bird className="h-5 w-5 text-background" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              Team Hub
            </p>
            <h1 className="font-serif text-2xl font-semibold uppercase tracking-wide text-foreground">
              Renim A.
            </h1>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted">
          Sign in with your team username and password.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-border bg-inset px-3 py-2.5 text-sm text-foreground outline-none ring-accent/40 placeholder:text-faint focus:ring-2"
              placeholder="coach"
              disabled={pending}
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-inset px-3 py-2.5 text-sm text-foreground outline-none ring-accent/40 placeholder:text-faint focus:ring-2"
              placeholder="••••••••"
              disabled={pending}
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            className="btn-primary w-full justify-center text-sm"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
