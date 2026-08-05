import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSessionToken,
} from "@/lib/auth/session";
import { normalizeUsername } from "@/lib/auth/token";

export const dynamic = "force-dynamic";

type Body = {
  username?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const usernameRaw =
      typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const username = normalizeUsername(usernameRaw);

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user?.active || !user.passwordHash || !user.username) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }

    const token = await signSessionToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    console.error("[auth/login]", error);
    const msg = error instanceof Error ? error.message : "Login failed";
    if (msg.includes("AUTH_SECRET")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    if (
      msg.includes("passwordHash") ||
      msg.includes("username") ||
      msg.includes("does not exist")
    ) {
      return NextResponse.json(
        {
          error:
            "Auth columns missing. Run prisma/turso-auth.sql on Turso (or prisma db push locally).",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
