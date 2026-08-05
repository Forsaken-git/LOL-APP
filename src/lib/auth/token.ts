import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "renim_session";
export const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};

export function getAuthSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short (min 16 chars). Set it in .env / Vercel.",
    );
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAgeSec(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getAuthSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    const id = typeof payload.sub === "string" ? payload.sub : null;
    const username =
      typeof payload.username === "string" ? payload.username : null;
    const name = typeof payload.name === "string" ? payload.name : null;
    const role =
      typeof payload.role === "string" ? (payload.role as UserRole) : null;
    if (!id || !username || !name || !role) return null;
    return { id, username, name, role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = sessionMaxAgeSec()) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Normalize login usernames: trim, lowercase, allow letters/digits/_/-/. */
export function normalizeUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (!username) return null;
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(username)) return null;
  return username;
}
