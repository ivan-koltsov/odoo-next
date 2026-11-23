import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { getProductById } from "@/lib/odoo/services/products";

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
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Invalid product ID", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const product = await getProductById(sessionId, id);
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
