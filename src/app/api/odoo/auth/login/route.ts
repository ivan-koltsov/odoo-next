import { NextResponse } from "next/server";
import { z } from "zod";
import { odooAuthenticate } from "@/lib/odoo/client";
import { setSessionCookie } from "@/lib/odoo/session";
import { toApiErrorResponse } from "@/lib/odoo/errors";

const loginSchema = z.object({
  login: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  db: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Invalid login payload",
          code: "INVALID_REQUEST",
        },
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
