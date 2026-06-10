import type { LoLRole, UserRole } from "@prisma/client";
import { syncPlayerToTrackingFiles } from "@/lib/roster-sync";
import { prisma } from "@/lib/prisma";
import { rosterExternalId } from "@/lib/team-roster";

const LOL_ROLES: LoLRole[] = [
  "TOP",
  "JUNGLE",
  "MID",
  "ADC",
  "SUPPORT",
  "FILL",
];

const MEMBER_ROLES: UserRole[] = ["PLAYER", "SUB"];

export type CreatePlayerInput = {
  displayName: string;
  summonerName: string;
  teamRole: LoLRole;
  memberRole?: UserRole;
};

export type CreatePlayerResult = {
  player: {
    id: string;
    displayName: string;
    summonerName: string | null;
    teamRole: LoLRole;
    memberRole: UserRole;
    externalId: string | null;
  };
  tracking: ReturnType<typeof syncPlayerToTrackingFiles>;
};

export function parseCreatePlayerBody(
  body: unknown,
): { ok: true; data: CreatePlayerInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  const displayName =
    typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  const summonerName =
    typeof raw.summonerName === "string" ? raw.summonerName.trim() : "";
  const teamRole = raw.teamRole;
  const memberRole = raw.memberRole;

  if (!displayName) {
    return { ok: false, error: "Display name is required" };
  }
  if (!summonerName) {
    return { ok: false, error: "Summoner name is required (Name#TAG)" };
  }
  if (!summonerName.includes("#")) {
    return {
      ok: false,
      error: "Summoner name must include a tag, e.g. Player#EUW",
    };
  }
  if (typeof teamRole !== "string" || !LOL_ROLES.includes(teamRole as LoLRole)) {
    return { ok: false, error: "A valid team role is required" };
  }
  if (
    memberRole !== undefined &&
    (typeof memberRole !== "string" ||
      !MEMBER_ROLES.includes(memberRole as UserRole))
  ) {
    return { ok: false, error: "Roster slot must be Starter or Sub" };
  }

  return {
    ok: true,
    data: {
      displayName,
      summonerName,
      teamRole: teamRole as LoLRole,
      memberRole: (memberRole as UserRole | undefined) ?? "PLAYER",
    },
  };
}

export async function createPlayer(
  input: CreatePlayerInput,
): Promise<CreatePlayerResult> {
  const externalId = rosterExternalId({
    displayName: input.displayName,
    summonerName: input.summonerName,
  });

  const existing = await prisma.player.findFirst({
    where: {
      active: true,
      OR: [
        { externalId },
        { summonerName: input.summonerName },
        { displayName: input.displayName },
      ],
    },
  });

  if (existing) {
    throw new Error(
      `A player already exists: ${existing.displayName}${existing.summonerName ? ` (${existing.summonerName})` : ""}`,
    );
  }

  const player = await prisma.player.create({
    data: {
      displayName: input.displayName,
      summonerName: input.summonerName,
      teamRole: input.teamRole,
      memberRole: input.memberRole ?? "PLAYER",
      externalId,
      active: true,
      accounts: {
        create: {
          region: "WEST",
          summonerName: input.summonerName,
        },
      },
    },
  });

  const tracking = syncPlayerToTrackingFiles({
    displayName: input.displayName,
    summonerName: input.summonerName,
    teamRole: input.teamRole,
    memberRole: input.memberRole ?? "PLAYER",
    externalId,
  });

  return {
    player: {
      id: player.id,
      displayName: player.displayName,
      summonerName: player.summonerName,
      teamRole: player.teamRole,
      memberRole: player.memberRole,
      externalId: player.externalId,
    },
    tracking,
  };
}

export const CREATE_PLAYER_ROLES = LOL_ROLES;
export const CREATE_PLAYER_MEMBER_ROLES = MEMBER_ROLES;
