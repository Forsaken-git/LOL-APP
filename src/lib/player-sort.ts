import type { LoLRole, UserRole } from "@prisma/client";

const ROLE_ORDER: LoLRole[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT", "FILL"];

const MEMBER_ORDER: UserRole[] = ["PLAYER", "SUB", "COACH", "MANAGER", "ANALYTICS"];

export function roleSortIndex(role: LoLRole): number {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}

export function memberSortIndex(role: UserRole): number {
  const i = MEMBER_ORDER.indexOf(role);
  return i === -1 ? MEMBER_ORDER.length : i;
}

function laneSortIndex(role: LoLRole, memberRole: UserRole): number {
  if (memberRole === "SUB") {
    if (role === "FILL") return 0;
    const i = ROLE_ORDER.indexOf(role);
    return i === -1 ? 50 : i + 1;
  }
  return roleSortIndex(role);
}

export function comparePlayersByRoster<
  T extends { teamRole: LoLRole; memberRole: UserRole; displayName: string },
>(a: T, b: T): number {
  const memberDiff = memberSortIndex(a.memberRole) - memberSortIndex(b.memberRole);
  if (memberDiff !== 0) return memberDiff;

  const roleDiff =
    laneSortIndex(a.teamRole, a.memberRole) - laneSortIndex(b.teamRole, b.memberRole);
  if (roleDiff !== 0) return roleDiff;

  return a.displayName.localeCompare(b.displayName);
}

export function sortPlayersByRoster<
  T extends { teamRole: LoLRole; memberRole: UserRole; displayName: string },
>(players: T[]): T[] {
  return [...players].sort(comparePlayersByRoster);
}
