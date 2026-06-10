"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PlayerRosterStatus({
  playerId,
  displayName,
  active,
  onChanged,
}: {
  playerId: string;
  displayName: string;
  active: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const nextActive = !active;
    const label = nextActive ? "restore to the active roster" : "hide from the roster";
    const detail = nextActive
      ? "They will appear in Schedule and new match forms again."
      : "Match history is kept. They will be removed from the active roster, Schedule, and LCU tracking files locally.";

    if (!window.confirm(`${displayName}: ${label}?\n\n${detail}`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update roster status");
        return;
      }
      onChanged?.();
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">
      {error && (
        <p className="mb-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {active
            ? "On the active roster — visible in Schedule and match forms."
            : "Hidden from the roster — stats and match history are preserved."}
        </p>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 text-xs"
          onClick={toggle}
          disabled={loading}
        >
          {active ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              {loading ? "Hiding…" : "Hide from roster"}
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              {loading ? "Restoring…" : "Restore to roster"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
