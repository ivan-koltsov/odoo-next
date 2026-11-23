import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSessionCookie, getSessionId } from "@/lib/odoo/session";
import { isOdooSessionExpiredError, toApiErrorResponse } from "@/lib/odoo/errors";
import { createPartner, listPartners } from "@/lib/odoo/services/partners";

export const dynamic = "force-dynamic";

const createPartnerSchema = z.object({
  name: z.string().trim().min(1, "Contact name is required").max(200),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  is_company: z.boolean().optional().default(false),
});

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
    const onlyCompanies = searchParams.get("onlyCompanies") === "true";
    const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

    const result = await listPartners(sessionId, {
      search,
      onlyCompanies,
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
        {
          error: parsed.error.issues[0]?.message || "Invalid partner payload",
          code: "INVALID_REQUEST",
        },
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
