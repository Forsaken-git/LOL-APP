import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  type SessionUser,
  verifySessionToken,
} from "@/lib/auth/token";

export type { SessionUser };
export {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionMaxAgeSec,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/token";

/** Read the current session from the request cookie store (Server Components / Route Handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
