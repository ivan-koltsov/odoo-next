import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { createPartner, listPartners } from "@/lib/odoo/services/partners";
import {
  createPartnerSchema,
  formatZodError,
  partnerListQuerySchema,
} from "@/lib/odoo/validation";

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
    const parsed = partnerListQuerySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      onlyCompanies: searchParams.get("onlyCompanies") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        formatZodError(parsed.error, "Invalid partner query parameters"),
        { status: 400 }
      );
    }

    const result = await listPartners(sessionId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (isOdooSessionExpiredError(error)) {
      await clearSessionCookie();
    }
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

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
    const parsed = createPartnerSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        formatZodError(parsed.error, "Invalid partner payload"),
        { status: 400 }
      );
    }

    const id = await createPartner(sessionId, parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (isOdooSessionExpiredError(error)) {
      await clearSessionCookie();
    }
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
