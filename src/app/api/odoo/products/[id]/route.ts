import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { getProductById } from "@/lib/odoo/services/products";
import { formatZodError, positiveIntIdSchema } from "@/lib/odoo/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const { id: rawId } = await context.params;
  const parsedId = positiveIntIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json(
      formatZodError(parsedId.error, "Invalid product ID"),
      { status: 400 }
    );
  }

  try {
    const product = await getProductById(sessionId, parsedId.data);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ product });
  } catch (error) {
    if (isOdooSessionExpiredError(error)) {
      await clearSessionCookie();
    }
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
