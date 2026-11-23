import { NextResponse } from "next/server";
import { odooDestroySession } from "@/lib/odoo/client";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";

export async function POST() {
  const sessionId = await getSessionId();
  if (sessionId) {
    await odooDestroySession(sessionId);
  }
  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
