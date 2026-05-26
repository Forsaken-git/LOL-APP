import { championImageUrl } from "@/lib/champions";
import { kdaString, type MatchScoreboardData, type ScoreboardRow } from "@/lib/match-scoreboard";

function TeamColumn({
  team,
  label,
}: {
  team: MatchScoreboardData["blue"];
  label: string;
}) {
  const header =
    team.side === "BLUE"
      ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
      : "border-rose-500/40 bg-rose-500/10 text-rose-200";

  return (
    <div className="min-w-0 flex-1">
      <div
        className={`mb-2 flex items-center justify-between rounded-lg border px-3 py-2 ${header}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span
          className={`text-xs font-bold ${team.won ? "text-emerald-400" : "text-muted"}`}
        >
          {team.won ? "Victory" : "Defeat"}
        </span>
      </div>
      <ul className="space-y-1">
        {team.rows.map((row, i) => (
          <ScoreboardRowItem key={`${row.champion}-${i}`} row={row} />
        ))}
      </ul>
    </div>
  );
}

function ScoreboardRowItem({ row }: { row: ScoreboardRow }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
        row.isOurTeam
          ? "border-accent/25 bg-accent/5"
          : "border-border/60 bg-inset/40"
      }`}
    >
      <img
        src={championImageUrl(row.champion)}
        alt={row.champion}
        className="champion-icon shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {row.summonerName}
        </p>
        <p className="truncate text-[10px] text-faint">{row.champion}</p>
      </div>
      <span className="shrink-0 tabular-nums text-sm font-semibold text-muted">
        {kdaString(row)}
      </span>
    </li>
  );
}

export function MatchScoreboard({ data }: { data: MatchScoreboardData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TeamColumn team={data.blue} label="Blue" />
      <TeamColumn team={data.red} label="Red" />
    </div>
  );
}
