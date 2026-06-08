import { prisma } from "@/lib/prisma";
import { rosterExternalId, teamRosterEntries } from "@/lib/team-roster";

export function playerIdentityKey(
  summonerName: string | null,
  displayName: string,
): string {
  if (summonerName) {
    const base = summonerName.split("#")[0]?.trim().toLowerCase() ?? "";
    if (base) return `sum:${base}`;
  }
  return `name:${displayName.trim().toLowerCase()}`;
}

export function pickCanonicalPlayer<
  T extends {
    id: string;
    externalId: string | null;
    participations: unknown[];
  },
>(group: T[]): T {
  return [...group].sort((a, b) => {
    const aLcu = a.externalId?.startsWith("player-") ? 1 : 0;
    const bLcu = b.externalId?.startsWith("player-") ? 1 : 0;
    if (aLcu !== bLcu) return bLcu - aLcu;
    return b.participations.length - a.participations.length;
  })[0]!;
}

/** Merge duplicate DB rows for display (same summoner, split participations). */
export function mergeDuplicatePlayerRows<
  T extends {
    id: string;
    displayName: string;
    summonerName: string | null;
    externalId: string | null;
    participations: { matchId: string }[];
  },
>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = playerIdentityKey(row.summonerName, row.displayName);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const merged: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }
    const keep = pickCanonicalPlayer(group);
    const partsByMatch = new Map<string, T["participations"][number]>();
    for (const row of group) {
      for (const part of row.participations) {
        partsByMatch.set(part.matchId, part);
      }
    }
    merged.push({
      ...keep,
      participations: [...partsByMatch.values()] as T["participations"],
    });
  }

  return merged;
}

async function mergeInto(keepId: string, removeId: string) {
  const dupeParts = await prisma.matchParticipant.findMany({
    where: { playerId: removeId },
  });

  for (const part of dupeParts) {
    const clash = await prisma.matchParticipant.findFirst({
      where: { matchId: part.matchId, playerId: keepId },
    });
    if (clash) {
      await prisma.matchParticipant.delete({ where: { id: part.id } });
    } else {
      await prisma.matchParticipant.update({
        where: { id: part.id },
        data: { playerId: keepId },
      });
    }
  }
  await prisma.match.updateMany({
    where: { mvpId: removeId },
    data: { mvpId: keepId },
  });
  await prisma.availabilitySlot.deleteMany({ where: { playerId: removeId } });
  await prisma.tierlist.updateMany({
    where: { playerId: removeId },
    data: { playerId: keepId },
  });
  await prisma.player.delete({ where: { id: removeId } });
}

export async function dedupeActivePlayers(): Promise<{
  groups: number;
  removed: number;
}> {
  const players = await prisma.player.findMany({
    where: { active: true },
    include: { participations: { select: { id: true } } },
  });

  const groups = new Map<string, typeof players>();
  for (const player of players) {
    const key = playerIdentityKey(player.summonerName, player.displayName);
    const list = groups.get(key) ?? [];
    list.push(player);
    groups.set(key, list);
  }

  let removed = 0;
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const keep = pickCanonicalPlayer(group);
    for (const dupe of group) {
      if (dupe.id === keep.id) continue;
      await mergeInto(keep.id, dupe.id);
      removed++;
    }
  }

  const remaining = await prisma.player.findMany({
    where: { active: true },
    include: { participations: { select: { id: true } } },
  });
  for (const entry of teamRosterEntries()) {
    const targetId = rosterExternalId(entry);
    const key = playerIdentityKey(entry.summonerName ?? null, entry.displayName);
    const matches = remaining.filter(
      (p) => playerIdentityKey(p.summonerName, p.displayName) === key,
    );
    if (matches.length === 0) continue;
    const keep = pickCanonicalPlayer(matches);
    if (keep.externalId !== targetId) {
      await prisma.player.update({
        where: { id: keep.id },
        data: { externalId: targetId },
      });
    }
  }

  return { groups: groups.size, removed };
}
