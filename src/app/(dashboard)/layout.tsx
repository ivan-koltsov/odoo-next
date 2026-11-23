import type { ReactNode } from "react";
import { requireSession } from "@/lib/odoo/session";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();
  return <AppShell>{children}</AppShell>;
}
