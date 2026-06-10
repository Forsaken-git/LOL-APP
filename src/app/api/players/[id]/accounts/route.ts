import { NextResponse } from "next/server";
import {
  ensurePlayerAccounts,
  parseAccountsBody,
  primarySummonerName,
} from "@/lib/player-accounts";
import { syncPlayerToTrackingFiles } from "@/lib/roster-sync";
import { prisma } from "@/lib/prisma";
import { rosterExternalId } from "@/lib/team-roster";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const accounts = await ensurePlayerAccounts(id);
  return NextResponse.json({ accounts });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAccountsBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  for (const account of parsed.accounts) {
    const conflict = await prisma.playerAccount.findFirst({
      where: {
        summonerName: account.summonerName,
        NOT: { playerId: id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `${account.summonerName} is already assigned to another player` },
        { status: 409 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.playerAccount.deleteMany({ where: { playerId: id } });
    if (parsed.accounts.length > 0) {
      await tx.playerAccount.createMany({
        data: parsed.accounts.map((account) => ({
          playerId: id,
          region: account.region,
          summonerName: account.summonerName,
        })),
      });
    }

    const primary = primarySummonerName(parsed.accounts, null);
    await tx.player.update({
      where: { id },
      data: { summonerName: primary },
    });
  });

  const west = parsed.accounts.find((a) => a.region === "WEST");
  let tracking = null;
  if (west) {
    tracking = syncPlayerToTrackingFiles({
      displayName: player.displayName,
      summonerName: west.summonerName,
      teamRole: player.teamRole,
      memberRole: player.memberRole,
      externalId: player.externalId ?? rosterExternalId({
        displayName: player.displayName,
        summonerName: west.summonerName,
      }),
    });
  }

  const saved = await ensurePlayerAccounts(id);

  return NextResponse.json({
    accounts: saved,
    summonerName: primarySummonerName(saved, null),
    tracking,
  });
}
