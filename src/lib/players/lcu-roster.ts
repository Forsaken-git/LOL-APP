import { rosterExternalId } from "@/lib/team-roster";
import { prisma } from "@/lib/prisma";
import { activeTeamPlayerWhere } from "@/lib/players/team-player";

export type LcuRosterEntry = {
  externalId: string;
  displayName: string;
  summonerName: string;
  teamRole: string;
  memberRole: string;
};

export type LcuRosterPayload = {
  teamSummoners: string[];
  roster: Record<string, LcuRosterEntry>;
};

function summonerKeys(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  return lower.includes("#") ? [lower] : [lower, `${lower.split("#")[0]}#*`];
}

/** Active roster formatted for the LCU collector (all linked Riot IDs). */
export async function buildLcuRosterPayload(): Promise<LcuRosterPayload> {
  const players = await prisma.player.findMany({
    where: activeTeamPlayerWhere,
    orderBy: [{ memberRole: "asc" }, { displayName: "asc" }],
    include: {
      accounts: { orderBy: [{ region: "asc" }, { createdAt: "asc" }] },
    },
  });

  const teamSummoners: string[] = [];
  const roster: Record<string, LcuRosterEntry> = {};
  const seenSummoners = new Set<string>();

  for (const player of players) {
    const externalId =
      player.externalId ??
      rosterExternalId({
        displayName: player.displayName,
        summonerName: player.summonerName ?? undefined,
      });

    const names = new Set<string>();
    if (player.summonerName?.trim()) names.add(player.summonerName.trim());
    for (const account of player.accounts) {
      if (account.summonerName?.trim()) names.add(account.summonerName.trim());
    }

    if (names.size === 0) continue;

    const entry: LcuRosterEntry = {
      externalId,
      displayName: player.displayName,
      summonerName: player.summonerName ?? [...names][0]!,
      teamRole: player.teamRole,
      memberRole: player.memberRole,
    };

    for (const name of names) {
      const key = name.toLowerCase();
      if (seenSummoners.has(key)) continue;
      seenSummoners.add(key);
      teamSummoners.push(name);
      roster[key] = { ...entry, summonerName: name };
    }
  }

  return { teamSummoners, roster };
}
