import { NextResponse } from "next/server";
import { odooGetSessionInfo } from "@/lib/odoo/client";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { toApiErrorResponse } from "@/lib/odoo/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  try {
    const user = await odooGetSessionInfo(sessionId);
    if (!user) {
      await clearSessionCookie();
      return NextResponse.json({ authenticated: false, user: null });
    }
    return NextResponse.json({ authenticated: true, user });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
