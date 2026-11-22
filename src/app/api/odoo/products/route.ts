import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { listProducts } from "@/lib/odoo/services/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const categoryIdParam = searchParams.get("categoryId");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    const categoryId = categoryIdParam ? Number.parseInt(categoryIdParam, 10) : undefined;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

    const result = await listProducts(sessionId, {
      search,
      categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isOdooSessionExpiredError(error)) {
      await clearSessionCookie();
    }
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
