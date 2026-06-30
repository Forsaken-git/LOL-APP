import type { EventType, GameType, Prisma } from "@prisma/client";

/** The competition types the team tracks. */
export type CompetitionId = "scrim" | "prime";

export type Competition = {
  id: CompetitionId;
  label: string;
  /** Stored on Match.league */
  league: string;
  gameType: GameType;
  eventType: EventType;
  /** Import folder names (lowercase patterns) */
  folderPatterns: string[];
};

export const COMPETITIONS: Competition[] = [
  {
    id: "scrim",
    label: "Scrims",
    league: "Scrim",
    gameType: "SCRIM",
    eventType: "SCRIM",
    folderPatterns: ["scrim", "scrims"],
  },
  {
    id: "prime",
    label: "Prime League",
    league: "Prime League",
    gameType: "OFFICIAL",
    eventType: "OTHER",
    folderPatterns: ["prime", "prime league", "prime-league", "primeleague"],
  },
];

export const COMPETITION_IDS = COMPETITIONS.map((c) => c.id);

export function competitionById(id: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === id);
}

export function isCompetitionId(value: string): value is CompetitionId {
  return COMPETITION_IDS.includes(value as CompetitionId);
}

export function competitionForLeague(league: string): Competition | undefined {
  const n = league.trim().toLowerCase();
  return COMPETITIONS.find(
    (c) =>
      c.league.toLowerCase() === n ||
      c.folderPatterns.some((p) => p === n),
  );
}

export function inferCompetitionFromPath(filePath: string): Competition | null {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  for (const c of COMPETITIONS) {
    for (const pattern of c.folderPatterns) {
      if (
        normalized.includes(`/${pattern}/`) ||
        normalized.endsWith(`/${pattern}`) ||
        normalized.includes(`/${pattern}.json`)
      ) {
        return c;
      }
    }
  }
  return null;
}

/** Prisma filter for matches in one competition (flexible league strings). */
export function matchWhereForCompetition(
  id: CompetitionId,
): Prisma.MatchWhereInput {
  const c = competitionById(id)!;
  const leagueVariants: string[] = [c.league];
  if (id === "scrim") leagueVariants.push("Scrim", "Scrims", "SCRIM");
  if (id === "prime") leagueVariants.push("Prime", "Prime League", "PrimeLeague");

  if (c.gameType === "SCRIM") {
    return {
      OR: [
        { league: { in: leagueVariants } },
        { gameType: "SCRIM" },
        { gameType: "TRAINING" },
      ],
    };
  }

  return {
    AND: [{ league: { in: leagueVariants } }, { gameType: c.gameType }],
  };
}

/** Prime League official games (excludes scrims) for league record stats. */
export function matchWhereLeaguePlay(): Prisma.MatchWhereInput {
  return matchWhereForCompetition("prime");
}

export const IMPORT_FOLDER_NAMES = ["scrims", "prime league"] as const;

/** Session grouping on /matches (scrims + Prime League only). */
export function matchUsesSessionGrouping(match: {
  league: string;
  gameType: string;
}): boolean {
  const comp = competitionForLeague(match.league);
  if (comp?.id === "scrim" || comp?.id === "prime") return true;
  if (match.gameType === "SCRIM" || match.gameType === "TRAINING") return true;
  const league = match.league.trim().toLowerCase();
  return league.includes("prime");
}
