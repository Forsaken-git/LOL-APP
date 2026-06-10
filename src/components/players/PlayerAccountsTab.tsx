"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import type { PlayerAccountEntry } from "@/lib/player-profile-types";
import {
  formatRegionLabel,
  normalizeSummonerKey,
  opGgProfileUrl,
  validateSummonerName,
} from "@/lib/player-accounts-shared";

const REGIONS: {
  region: PlayerAccountEntry["region"];
  placeholder: string;
}[] = [
  { region: "WEST", placeholder: "Player#EUW" },
  { region: "EAST", placeholder: "Player#EUNE" },
];

type DraftAccount = PlayerAccountEntry & { clientKey: string };

function toDraft(accounts: PlayerAccountEntry[]): DraftAccount[] {
  return accounts.map((account, index) => ({
    ...account,
    clientKey:
      account.id ?? `${account.region}-${normalizeSummonerKey(account.summonerName)}-${index}`,
  }));
}

export function PlayerAccountsTab({
  playerId,
  initialAccounts,
}: {
  playerId: string;
  initialAccounts: PlayerAccountEntry[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<DraftAccount[]>(() =>
    toDraft(initialAccounts),
  );
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({
    WEST: "",
    EAST: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(toDraft(initialAccounts));
    setDraftInputs({ WEST: "", EAST: "" });
    setError(null);
    setSuccess(null);
  }, [playerId, initialAccounts]);

  function addAccount(region: PlayerAccountEntry["region"]) {
    const summonerName = draftInputs[region]?.trim() ?? "";
    const validation = validateSummonerName(summonerName);
    if (validation) {
      setError(`${formatRegionLabel(region)}: ${validation}`);
      return;
    }

    const key = normalizeSummonerKey(summonerName);
    if (accounts.some((a) => normalizeSummonerKey(a.summonerName) === key)) {
      setError(`${summonerName} is already on this player`);
      return;
    }

    setAccounts((prev) => [
      ...prev,
      {
        region,
        summonerName,
        clientKey: `${region}-${key}-${Date.now()}`,
      },
    ]);
    setDraftInputs((prev) => ({ ...prev, [region]: "" }));
    setError(null);
    setSuccess(null);
  }

  function removeAccount(clientKey: string) {
    setAccounts((prev) => prev.filter((a) => a.clientKey !== clientKey));
    setError(null);
    setSuccess(null);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (accounts.length === 0) {
      setError("Add at least one account.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/players/${playerId}/accounts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accounts: accounts.map(({ region, summonerName }) => ({
            region,
            summonerName,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save accounts");
        return;
      }
      setSuccess("Accounts saved.");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <p className="text-xs text-muted">
        Add multiple Riot IDs per server. Each account links to op.gg. The first
        EU West account is used for LCU match tracking.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {REGIONS.map(({ region, placeholder }) => {
          const list = accounts.filter((account) => account.region === region);
          return (
            <section
              key={region}
              className="rounded-xl border border-border bg-inset/30 p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
                {formatRegionLabel(region)}
              </h3>

              <ul className="mt-3 space-y-2">
                {list.length === 0 ? (
                  <li className="text-xs text-faint">No accounts yet</li>
                ) : (
                  list.map((account) => (
                    <li
                      key={account.clientKey}
                      className="flex items-center gap-2 rounded-lg border border-border/80 bg-surface/60 px-2.5 py-2"
                    >
                      <a
                        href={opGgProfileUrl(region, account.summonerName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-accent inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium"
                        title="View on op.gg"
                      >
                        <span className="truncate">{account.summonerName}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAccount(account.clientKey)}
                        className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        aria-label={`Remove ${account.summonerName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <div className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1"
                  value={draftInputs[region] ?? ""}
                  onChange={(e) =>
                    setDraftInputs((prev) => ({
                      ...prev,
                      [region]: e.target.value,
                    }))
                  }
                  placeholder={placeholder}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAccount(region);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost inline-flex shrink-0 items-center gap-1 px-2.5 py-2 text-xs"
                  onClick={() => addAccount(region)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-400" role="status">
          {success}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Save accounts"}
        </button>
      </div>
    </form>
  );
}
