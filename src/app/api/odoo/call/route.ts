import { NextResponse } from "next/server";
import { z } from "zod";
import { odooCall } from "@/lib/odoo/client";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";

const callSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_.]+$/i, "Invalid Odoo model name"),
  method: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/i, "Invalid Odoo method name"),
  args: z.array(z.unknown()).optional().default([]),
  kwargs: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = callSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Invalid JSON-RPC payload",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const { model, method, args, kwargs } = parsed.data;
    const result = await odooCall(model, method, args, kwargs, { sessionId });

    return NextResponse.json({ result });
  } catch (error) {
    if (isOdooSessionExpiredError(error)) {
      await clearSessionCookie();
    }
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
