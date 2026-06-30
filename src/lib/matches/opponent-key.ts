export function normalizeOpponent(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function sameLeague(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** Same scrim/series when opponent + league align and times are within one day. */
export function gameMatchesDraft(
  match: { opponent: string | null; league: string; playedAt: Date },
  draft: { opponent: string | null; league: string; scheduledAt: Date },
): boolean {
  if (normalizeOpponent(match.opponent) !== normalizeOpponent(draft.opponent)) {
    return false;
  }
  if (!sameLeague(match.league, draft.league)) return false;
  const diff = Math.abs(match.playedAt.getTime() - draft.scheduledAt.getTime());
  return diff <= 24 * 60 * 60 * 1000;
}
