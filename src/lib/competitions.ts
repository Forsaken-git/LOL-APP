import type { EventType, GameType, Prisma } from "@prisma/client";

/** The three competition types the team tracks. */
export type CompetitionId = "cwl" | "titans" | "scrim";

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
    id: "cwl",
    label: "CWL",
    league: "CWL",
    gameType: "OFFICIAL",
    eventType: "CWL",
    folderPatterns: ["cwl", "officials", "official"],
  },
  {
    id: "titans",
    label: "Titans",
    league: "Titans League",
    gameType: "OFFICIAL",
    eventType: "TITANS",
    folderPatterns: [
      "titans",
      "titans league",
      "titans-league",
      "titansleague",
      "titans_league",
    ],
  },
  {
    id: "scrim",
    label: "Scrims",
    league: "Scrim",
    gameType: "SCRIM",
    eventType: "SCRIM",
    folderPatterns: ["scrim", "scrims"],
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
      c.folderPatterns.some((p) => p === n) ||
      (c.id === "cwl" && n === "official"),
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
  if (id === "cwl") leagueVariants.push("Official", "CWL");
  if (id === "titans") leagueVariants.push("Titans", "Titans League");
  if (id === "scrim") leagueVariants.push("Scrim", "Scrims", "SCRIM");

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

/** CWL + Titans (excludes scrims) for league record stats. */
export function matchWhereLeaguePlay(): Prisma.MatchWhereInput {
  return {
    OR: [
      matchWhereForCompetition("cwl"),
      matchWhereForCompetition("titans"),
    ],
  };
}

export const IMPORT_FOLDER_NAMES = [
  "cwl",
  "titans league",
  "scrims",
] as const;
