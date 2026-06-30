"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function PlayerDeleteButton({
  playerId,
  displayName,
  gameCount,
  onDeleted,
}: {
  playerId: string;
  displayName: string;
  gameCount: number;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const detail =
      gameCount > 0
        ? `Their rows will be removed from ${gameCount} game${gameCount === 1 ? "" : "s"}. Matches are kept.`
        : "This cannot be undone.";
    if (
      !window.confirm(
        `Delete ${displayName} permanently?\n\n${detail}\n\nTierlists and availability for this player are also removed.`,
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/players/${playerId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete player");
        return;
      }
      onDeleted?.();
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
          Permanently remove this player from the hub.
        </p>
        <button
          type="button"
          className="btn-ghost inline-flex items-center gap-1.5 text-xs text-rose-300"
          onClick={() => void remove()}
          disabled={loading}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {loading ? "Deleting…" : "Delete player"}
        </button>
      </div>
    </div>
  );
}
