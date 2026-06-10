"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import type { LoLRole, UserRole } from "@prisma/client";
import { formatTeamRole } from "@/lib/player-display";

const TEAM_ROLES: LoLRole[] = [
  "TOP",
  "JUNGLE",
  "MID",
  "ADC",
  "SUPPORT",
  "FILL",
];

type TrackingSync = {
  teamRoster: string;
  lcuConfig: string;
};

function trackingMessage(tracking: TrackingSync): string | null {
  const parts: string[] = [];
  if (tracking.teamRoster === "updated") {
    parts.push("team-roster.json");
  }
  if (tracking.lcuConfig === "updated") {
    parts.push("lcu-spectate.config.json");
  }
  if (parts.length === 0) return null;
  return `Also added to ${parts.join(" and ")} for LCU tracking.`;
}

export function AddPlayerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [summonerName, setSummonerName] = useState("");
  const [teamRole, setTeamRole] = useState<LoLRole>("FILL");
  const [memberRole, setMemberRole] = useState<UserRole>("PLAYER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          summonerName,
          teamRole,
          memberRole,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        tracking?: TrackingSync;
        player?: { displayName: string };
      };

      if (!res.ok) {
        setError(data.error ?? "Could not add player");
        return;
      }

      const trackingNote = data.tracking
        ? trackingMessage(data.tracking)
        : null;
      setSuccess(
        trackingNote
          ? `${data.player?.displayName ?? "Player"} added. ${trackingNote}`
          : `${data.player?.displayName ?? "Player"} added to the roster.`,
      );
      setDisplayName("");
      setSummonerName("");
      setTeamRole("FILL");
      setMemberRole("PLAYER");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost inline-flex items-center gap-2 text-sm"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Add player
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-inset/40 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Add player</h2>
        <button
          type="button"
          className="text-xs text-muted transition-colors hover:text-foreground"
          onClick={() => {
            setOpen(false);
            setError(null);
            setSuccess(null);
          }}
        >
          Cancel
        </button>
      </div>

      <p className="mb-4 text-xs text-muted">
        Adds to the hub roster and, when running locally, updates{" "}
        <code className="text-faint">team-roster.json</code> and{" "}
        <code className="text-faint">lcu-spectate.config.json</code> for match
        tracking.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Display name
          <input
            className="mt-1 w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Filkus"
            required
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-muted">
          Riot ID
          <input
            className="mt-1 w-full"
            value={summonerName}
            onChange={(e) => setSummonerName(e.target.value)}
            placeholder="Filkus#XDD"
            required
            autoComplete="off"
          />
        </label>
        <label className="block text-xs text-muted">
          Lane
          <select
            className="mt-1 w-full"
            value={teamRole}
            onChange={(e) => setTeamRole(e.target.value as LoLRole)}
          >
            {TEAM_ROLES.map((role) => (
              <option key={role} value={role}>
                {formatTeamRole(role)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Roster slot
          <select
            className="mt-1 w-full"
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as UserRole)}
          >
            <option value="PLAYER">Starter</option>
            <option value="SUB">Sub</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 text-xs text-emerald-400" role="status">
          {success}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Adding…" : "Add to roster"}
        </button>
      </div>
    </form>
  );
}
