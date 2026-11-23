import type { Metadata } from "next";
import { requireSession } from "@/lib/odoo/session";
import { listPartners } from "@/lib/odoo/services/partners";
import type { OdooPartner, PaginatedResult } from "@/lib/odoo/types";
import { PartnersClient } from "./partners-client";

export const metadata: Metadata = {
  title: "Contacts",
};

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const { sessionId } = await requireSession();

  let initialData: PaginatedResult<OdooPartner> = {
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  };
  let initialError: string | null = null;

  try {
    initialData = await listPartners(sessionId, { limit: 20, offset: 0 });
  } catch (error) {
    initialError =
      error instanceof Error ? error.message : "Failed to load contacts from Odoo.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read and create <code className="font-mono text-xs">res.partner</code> records
          directly in Odoo via JSON-RPC.
        </p>
      </div>

      <PartnersClient initialData={initialData} initialError={initialError} />
    </div>
  );
}
