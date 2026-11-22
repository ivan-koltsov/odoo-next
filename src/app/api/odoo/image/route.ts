import { NextResponse } from "next/server";
import { getOdooConfig } from "@/lib/odoo/config";
import { getSessionId } from "@/lib/odoo/session";
import { formatZodError, imageQuerySchema } from "@/lib/odoo/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = imageQuerySchema.safeParse({
    model: searchParams.get("model") ?? "",
    id: searchParams.get("id") ?? "",
    field: searchParams.get("field") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      formatZodError(parsed.error, "Invalid image parameters"),
      { status: 400 }
    );
  }

  const validated = parsed.data;
  const { baseUrl, timeoutMs } = getOdooConfig();
  const odooImageUrl = `${baseUrl}/web/image?model=${encodeURIComponent(
    validated.model
  )}&id=${validated.id}&field=${encodeURIComponent(validated.field)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(odooImageUrl, {
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
