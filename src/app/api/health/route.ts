import { NextResponse } from "next/server";
import { getOdooConfig } from "@/lib/odoo/config";
import { odooGetVersionInfo } from "@/lib/odoo/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getOdooConfig();

  try {
    const version = await odooGetVersionInfo({ timeoutMs: 3_000 });
    return NextResponse.json({
      status: "ok",
      odoo: {
        reachable: true,
        serverVersion: version.server_version,
        defaultDb: config.db,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: "degraded",
      odoo: {
        reachable: false,
        defaultDb: config.db,
        error:
          error instanceof Error ? error.message : "Unable to connect to Odoo",
      },
    });
  }
}
