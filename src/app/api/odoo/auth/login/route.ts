import { NextResponse } from "next/server";
import { odooAuthenticate } from "@/lib/odoo/client";
import { setSessionCookie } from "@/lib/odoo/session";
import { toApiErrorResponse } from "@/lib/odoo/errors";
import { formatZodError, loginSchema } from "@/lib/odoo/validation";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        formatZodError(parsed.error, "Invalid login payload"),
        { status: 400 }
      );
    }

    const { user, sessionId } = await odooAuthenticate(parsed.data);
    await setSessionCookie(sessionId);

    return NextResponse.json({ user });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
