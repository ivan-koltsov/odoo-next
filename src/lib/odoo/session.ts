import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOdooConfig } from "./config";
import { odooGetSessionInfo } from "./client";
import type { OdooSessionUser } from "./types";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const { sessionCookieName } = getOdooConfig();
  return cookieStore.get(sessionCookieName)?.value ?? null;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  const { sessionCookieName } = getOdooConfig();

  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const { sessionCookieName } = getOdooConfig();

  cookieStore.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export interface ActiveOdooSession {
  sessionId: string;
  user: OdooSessionUser;
}

/**
 * Validates the HttpOnly Odoo session cookie against `/web/session/get_session_info`.
 * Returns `null` when no cookie is set, session expired, or Odoo is temporarily unreachable.
 */
export async function getCurrentSession(): Promise<ActiveOdooSession | null> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return null;
  }

  try {
    const user = await odooGetSessionInfo(sessionId);
    if (!user) {
      return null;
    }
    return { sessionId, user };
  } catch {
    return null;
  }
}

/**
 * Server Component guard that ensures an active Odoo session exists.
 */
export async function requireSession(): Promise<ActiveOdooSession> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
