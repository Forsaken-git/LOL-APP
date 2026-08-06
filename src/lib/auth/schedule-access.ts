import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeTeamPlayerWhere } from "@/lib/players/team-player";
import type { SessionUser } from "@/lib/auth/token";

/** Only analytics can edit any player's availability grid. */
export function canManageAllSchedules(role: UserRole): boolean {
  return role === "ANALYTICS";
}

/**
 * Resolve the roster Player linked to this login.
 * Prefer Player.userId; otherwise match display/summoner name and auto-link once.
 */
export async function resolveOwnPlayerId(
  session: SessionUser,
): Promise<string | null> {
  const linked = await prisma.player.findFirst({
    where: { userId: session.id, ...activeTeamPlayerWhere },
    select: { id: true },
  });
  if (linked) return linked.id;

  const candidates = await prisma.player.findMany({
    where: activeTeamPlayerWhere,
    select: {
      id: true,
      userId: true,
      displayName: true,
      summonerName: true,
    },
  });

  const keys = new Set(
    [session.username, session.name]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const match = candidates.find((p) => {
    if (p.userId && p.userId !== session.id) return false;
    const names = [p.displayName, p.summonerName ?? ""]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return names.some((n) => keys.has(n));
  });

  if (!match) return null;

  if (!match.userId) {
    try {
      await prisma.player.update({
        where: { id: match.id },
        data: { userId: session.id },
      });
    } catch {
      // Unique conflict if another request linked first — still return match id.
    }
  }

  return match.id;
}

export async function canEditPlayerSchedule(
  session: SessionUser,
  playerId: string,
): Promise<boolean> {
  if (canManageAllSchedules(session.role)) return true;
  const ownId = await resolveOwnPlayerId(session);
  return ownId === playerId;
}
