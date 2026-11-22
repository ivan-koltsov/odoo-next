import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { listProducts } from "@/lib/odoo/services/products";
import { formatZodError, productListQuerySchema } from "@/lib/odoo/validation";

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
    const parsed = productListQuerySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        formatZodError(parsed.error, "Invalid product query parameters"),
        { status: 400 }
      );
    }

    const result = await listProducts(sessionId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (isOdooSessionExpiredError(error)) {
      await clearSessionCookie();
    }
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
