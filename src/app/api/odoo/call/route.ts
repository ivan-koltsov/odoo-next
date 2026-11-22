import { NextResponse } from "next/server";
import { odooCall } from "@/lib/odoo/client";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { formatZodError, rpcCallSchema } from "@/lib/odoo/validation";

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
    const parsed = rpcCallSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        formatZodError(parsed.error, "Invalid JSON-RPC payload"),
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
