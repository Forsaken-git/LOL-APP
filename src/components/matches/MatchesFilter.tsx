"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { COMPETITIONS, type CompetitionId } from "@/lib/competitions";

export function MatchesFilter({ current }: { current?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setCompetition(id: CompetitionId | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("competition", id);
    else params.delete("competition");
    params.delete("league");
    router.push(`/matches?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={`rounded-lg px-3 py-1.5 text-xs ${!current ? "btn-primary" : "btn-ghost"}`}
        onClick={() => setCompetition(null)}
      >
        All
      </button>
      {COMPETITIONS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs ${current === c.id ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setCompetition(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
